const bcrypt = require('bcryptjs');
const { get, run } = require('../database');
const { resetPassword, findUserByIdentifier } = require('../services/adService');
const { audit } = require('../services/auditService');
const { hash } = require('../services/cryptoService');

// Password complexity — mirrors frontend validation
function validatePasswordComplexity(password, adUser) {
  if (password.length < 8) return 'Senha deve ter no mínimo 8 caracteres.';
  if (!/[A-Z]/.test(password)) return 'Senha deve conter letra maiúscula.';
  if (!/[a-z]/.test(password)) return 'Senha deve conter letra minúscula.';
  if (!/[0-9]/.test(password)) return 'Senha deve conter número.';
  if (!/[^a-zA-Z0-9]/.test(password)) return 'Senha deve conter caractere especial.';

  const lower = password.toLowerCase();
  if (adUser?.username && lower.includes(adUser.username.toLowerCase())) {
    return 'A senha não pode conter o nome de usuário.';
  }
  if (adUser?.mail) {
    const mailLocal = adUser.mail.split('@')[0].toLowerCase();
    if (mailLocal.length > 2 && lower.includes(mailLocal)) {
      return 'A senha não pode conter parte do e-mail.';
    }
  }
  if (adUser?.displayName) {
    const nameParts = adUser.displayName.toLowerCase().split(/\s+/);
    for (const part of nameParts) {
      if (part.length > 2 && lower.includes(part)) {
        return 'A senha não pode conter seu nome.';
      }
    }
  }
  return null;
}

async function verifyFactor2(req, res) {
  const { factorType, answer, answer2 } = req.body;
  const { resetSession } = req;
  const ip = req.ip;
  const userAgent = req.headers['user-agent'] || '';

  const factors = await get(`SELECT * FROM user_factors WHERE ad_username=?`, [resetSession.ad_username]);

  let verified = false;

  if (factorType === 'security_questions') {
    if (!factors?.security_answer_1_hash || !factors?.security_answer_2_hash) {
      return res.status(400).json({ error: 'Fator não disponível.' });
    }
    const ok1 = await bcrypt.compare(answer?.toLowerCase().trim() || '', factors.security_answer_1_hash);
    const ok2 = await bcrypt.compare(answer2?.toLowerCase().trim() || '', factors.security_answer_2_hash);
    verified = ok1 && ok2;

  } else if (factorType === 'birth_date') {
    if (!factors?.birth_date_hash) {
      return res.status(400).json({ error: 'Fator não disponível.' });
    }
    const inputHash = hash(answer?.trim() || '');
    verified = inputHash === factors.birth_date_hash;

  } else if (factorType === 'employee_id') {
    // Compare last 4 chars of employeeID
    const adUser = await findUserByIdentifier(resetSession.ad_username).catch(() => null);
    if (!adUser?.employeeID) {
      return res.status(400).json({ error: 'Fator não disponível.' });
    }
    const last4 = adUser.employeeID.slice(-4);
    verified = answer?.trim() === last4;

  } else {
    return res.status(400).json({ error: 'Tipo de fator inválido.' });
  }

  if (!verified) {
    await audit({
      ip, userAgent, identifier: '',
      step: 'factor2_verify', success: false,
      failureReason: 'invalid_answer',
      adUsername: resetSession.ad_username,
      sessionId: resetSession.id,
    });
    return res.status(400).json({ error: 'Verificação incorreta. Tente novamente.' });
  }

  await run(`UPDATE reset_sessions SET factor2_verified=1 WHERE id=?`, [resetSession.id]);
  await audit({
    ip, userAgent, identifier: '',
    step: 'factor2_verify', success: true,
    adUsername: resetSession.ad_username,
    sessionId: resetSession.id,
  });

  return res.json({ verified: true });
}

async function doPasswordReset(req, res) {
  const { password } = req.body;
  const { resetSession } = req;
  const ip = req.ip;
  const userAgent = req.headers['user-agent'] || '';

  // Get AD user info for validation (username only — no sensitive data)
  const adUser = await findUserByIdentifier(resetSession.ad_username).catch(() => null);

  const complexityError = validatePasswordComplexity(password, adUser);
  if (complexityError) {
    return res.status(400).json({ error: complexityError });
  }

  try {
    await resetPassword(resetSession.ad_username, password);
  } catch (err) {
    await audit({
      ip, userAgent, identifier: '',
      step: 'password_reset', success: false,
      failureReason: 'ad_reset_error',
      adUsername: resetSession.ad_username,
      sessionId: resetSession.id,
    });
    return res.status(500).json({ error: 'Não foi possível redefinir a senha. Contate o suporte.' });
  }

  await audit({
    ip, userAgent, identifier: '',
    step: 'password_reset', success: true,
    adUsername: resetSession.ad_username,
    sessionId: resetSession.id,
  });

  // Invalidate the reset session
  await run(`DELETE FROM reset_sessions WHERE id=?`, [resetSession.id]);
  req.session.destroy(() => {});

  return res.json({ success: true, message: 'Senha redefinida com sucesso.' });
}

async function registerFactors(req, res) {
  const { adUsername, personalEmail, phone, securityQuestion1, securityAnswer1, securityQuestion2, securityAnswer2, birthDate } = req.body;
  const ip = req.ip;
  const userAgent = req.headers['user-agent'] || '';
  const { encrypt, hash } = require('../services/cryptoService');

  // Verify the user exists in AD before registering
  const adUser = await findUserByIdentifier(adUsername).catch(() => null);
  if (!adUser) {
    return res.status(404).json({ error: 'Usuário não encontrado.' });
  }

  const personalEmailEnc = personalEmail ? encrypt(personalEmail) : null;
  const phoneEnc = phone ? encrypt(phone) : null;
  const answer1Hash = securityAnswer1 ? await bcrypt.hash(securityAnswer1.toLowerCase().trim(), 12) : null;
  const answer2Hash = securityAnswer2 ? await bcrypt.hash(securityAnswer2.toLowerCase().trim(), 12) : null;
  const birthDateHash = birthDate ? hash(birthDate) : null;

  await run(`
    INSERT INTO user_factors
      (ad_username, personal_email_enc, phone_enc, security_question_1, security_answer_1_hash, security_question_2, security_answer_2_hash, birth_date_hash)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(ad_username) DO UPDATE SET
      personal_email_enc=excluded.personal_email_enc,
      phone_enc=excluded.phone_enc,
      security_question_1=excluded.security_question_1,
      security_answer_1_hash=excluded.security_answer_1_hash,
      security_question_2=excluded.security_question_2,
      security_answer_2_hash=excluded.security_answer_2_hash,
      birth_date_hash=excluded.birth_date_hash,
      updated_at=strftime('%s','now')
  `, [adUser.username, personalEmailEnc, phoneEnc, securityQuestion1, answer1Hash, securityQuestion2, answer2Hash, birthDateHash]);

  await audit({ ip, userAgent, identifier: hash(adUsername), step: 'register_factors', success: true, adUsername: adUser.username });

  return res.json({ success: true });
}

module.exports = { verifyFactor2, doPasswordReset, registerFactors };
