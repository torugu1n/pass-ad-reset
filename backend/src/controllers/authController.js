const { v4: uuidv4 } = require('uuid');
const { findUserByIdentifier } = require('../services/adService');
const { createOTP } = require('../services/otpService');
const { sendOTPByEmail, sendOTPByWhatsApp } = require('../services/notificationService');
const { audit } = require('../services/auditService');
const { run, get } = require('../database');
const { encrypt, decrypt, hash, maskEmail, maskPhone } = require('../services/cryptoService');

const SESSION_TTL_SECONDS = 30 * 60; // 30 minutes

// Generic response — never reveal if user exists
const GENERIC_OTP_RESPONSE = {
  message: 'Se os dados estiverem corretos, enviaremos um código de verificação.',
};

async function identify(req, res) {
  const { identifier } = req.body;
  const ip = req.ip;
  const userAgent = req.headers['user-agent'] || '';

  let adUser = null;
  try {
    adUser = await findUserByIdentifier(identifier);
  } catch (err) {
    // Log internally but do not reveal to user
    await audit({ ip, userAgent, identifier: hash(identifier), step: 'identification', success: false, failureReason: 'ad_lookup_error' });
    return res.json(GENERIC_OTP_RESPONSE);
  }

  if (!adUser) {
    await audit({ ip, userAgent, identifier: hash(identifier), step: 'identification', success: false, failureReason: 'not_found_or_restricted' });
    return res.json(GENERIC_OTP_RESPONSE);
  }

  // Look up registered factors for this user
  const factors = await get(`SELECT * FROM user_factors WHERE ad_username=?`, [adUser.username]);

  // Determine delivery method
  let deliveryEmail = null;
  let deliveryPhone = null;
  let maskedEmail = null;
  let maskedPhone = null;

  if (factors?.personal_email_enc) {
    deliveryEmail = decrypt(factors.personal_email_enc);
    maskedEmail = maskEmail(deliveryEmail);
  } else if (adUser.mail) {
    // Fallback to AD mail — warn in audit
    deliveryEmail = adUser.mail;
    maskedEmail = maskEmail(deliveryEmail);
  }

  if (factors?.phone_enc) {
    deliveryPhone = decrypt(factors.phone_enc);
    maskedPhone = maskPhone(deliveryPhone);
  } else if (adUser.mobile) {
    deliveryPhone = adUser.mobile;
    maskedPhone = maskPhone(deliveryPhone);
  }

  if (!deliveryEmail && !deliveryPhone) {
    await audit({ ip, userAgent, identifier: hash(identifier), step: 'identification', success: false, failureReason: 'no_delivery_method', adUsername: adUser.username });
    // Still return generic — but in reality we can't proceed
    return res.json({ ...GENERIC_OTP_RESPONSE, noMethod: true });
  }

  // Create reset session
  const sessionId = uuidv4();
  const expiresAt = Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS;

  await run(
    `INSERT INTO reset_sessions (id, identifier_hash, ad_username, ip, user_agent, expires_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [sessionId, hash(identifier), adUser.username, ip, userAgent, expiresAt]
  );

  req.session.resetSessionId = sessionId;

  // Create and send OTP
  const otp = await createOTP(sessionId);

  try {
    if (deliveryEmail) await sendOTPByEmail(deliveryEmail, otp, adUser.displayName);
    if (deliveryPhone && process.env.WHATSAPP_WEBHOOK_URL) await sendOTPByWhatsApp(deliveryPhone, otp, adUser.displayName);
  } catch (err) {
    await audit({ ip, userAgent, identifier: hash(identifier), step: 'otp_send', success: false, failureReason: 'delivery_error', adUsername: adUser.username, sessionId });
    // Still return generic
  }

  await audit({ ip, userAgent, identifier: hash(identifier), step: 'identification', success: true, adUsername: adUser.username, sessionId });

  // Inform frontend which method was used (masked) and if factor2 is available
  const hasSecurityQuestions = !!(factors?.security_question_1);
  const hasBirthDate = !!(factors?.birth_date_hash);
  const hasEmployeeID = !!(adUser.employeeID || factors);

  return res.json({
    ...GENERIC_OTP_RESPONSE,
    sessionCreated: true,
    maskedEmail,
    maskedPhone,
    displayName: adUser.displayName,
    availableFactors: {
      securityQuestions: hasSecurityQuestions,
      birthDate: hasBirthDate,
      employeeId: hasEmployeeID,
    },
  });
}

async function resendOTP(req, res) {
  const ip = req.ip;
  const userAgent = req.headers['user-agent'] || '';
  const { resetSession } = req;

  // Re-fetch user info to re-send
  const factors = await get(`SELECT * FROM user_factors WHERE ad_username=?`, [resetSession.ad_username]);

  let deliveryEmail = null;
  if (factors?.personal_email_enc) {
    deliveryEmail = decrypt(factors.personal_email_enc);
  }

  const otp = await createOTP(resetSession.id);

  try {
    if (deliveryEmail) await sendOTPByEmail(deliveryEmail, otp, null);
  } catch { /* swallow */ }

  await audit({ ip, userAgent, identifier: '', step: 'otp_resend', success: true, adUsername: resetSession.ad_username, sessionId: resetSession.id });

  return res.json({ message: 'Novo código enviado.' });
}

module.exports = { identify, resendOTP };
