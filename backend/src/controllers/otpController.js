const { verifyOTP } = require('../services/otpService');
const { audit } = require('../services/auditService');
const { run, get } = require('../database');
const { hash } = require('../services/cryptoService');

async function verifyOTPHandler(req, res) {
  const { otp } = req.body;
  const { resetSession } = req;
  const ip = req.ip;
  const userAgent = req.headers['user-agent'] || '';

  const result = await verifyOTP(resetSession.id, otp);

  if (!result.valid) {
    await audit({
      ip, userAgent, identifier: '',
      step: 'otp_verify', success: false,
      failureReason: result.reason,
      adUsername: resetSession.ad_username,
      sessionId: resetSession.id,
    });

    const message = result.reason === 'max_attempts'
      ? 'Número máximo de tentativas atingido. Reinicie o processo.'
      : 'Código incorreto ou expirado.';

    return res.status(400).json({ error: message });
  }

  // Mark OTP verified in session
  await run(`UPDATE reset_sessions SET otp_verified=1 WHERE id=?`, [resetSession.id]);

  await audit({
    ip, userAgent, identifier: '',
    step: 'otp_verify', success: true,
    adUsername: resetSession.ad_username,
    sessionId: resetSession.id,
  });

  // Return available factor2 options
  const factors = await get(`SELECT * FROM user_factors WHERE ad_username=?`, [resetSession.ad_username]);

  return res.json({
    verified: true,
    factor2Options: {
      securityQuestions: !!(factors?.security_question_1),
      birthDate: !!(factors?.birth_date_hash),
      employeeId: true, // always available if AD has employeeID
    },
    securityQuestion1: factors?.security_question_1 || null,
    securityQuestion2: factors?.security_question_2 || null,
  });
}

module.exports = { verifyOTPHandler };
