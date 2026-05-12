const crypto = require('crypto');
const { run, get } = require('../database');

const OTP_EXPIRATION_MINUTES = parseInt(process.env.OTP_EXPIRATION_MINUTES || '5', 10);
const OTP_MAX_ATTEMPTS = parseInt(process.env.OTP_MAX_ATTEMPTS || '5', 10);

function generateOTP() {
  // 6-digit numeric OTP
  return crypto.randomInt(100000, 999999).toString();
}

function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

async function createOTP(sessionId) {
  const token = generateOTP();
  const tokenHash = hashToken(token);
  const expiresAt = Math.floor(Date.now() / 1000) + OTP_EXPIRATION_MINUTES * 60;

  // Invalidate previous OTPs for this session
  await run(`UPDATE otp_tokens SET used=1 WHERE session_id=? AND used=0`, [sessionId]);

  await run(
    `INSERT INTO otp_tokens (session_id, token_hash, expires_at) VALUES (?, ?, ?)`,
    [sessionId, tokenHash, expiresAt]
  );

  return token;
}

async function verifyOTP(sessionId, token) {
  const now = Math.floor(Date.now() / 1000);
  const record = await get(
    `SELECT * FROM otp_tokens
     WHERE session_id=? AND used=0 AND expires_at>?
     ORDER BY created_at DESC LIMIT 1`,
    [sessionId, now]
  );

  if (!record) return { valid: false, reason: 'expired_or_not_found' };

  if (record.attempts >= OTP_MAX_ATTEMPTS) {
    return { valid: false, reason: 'max_attempts' };
  }

  // Increment attempts
  await run(`UPDATE otp_tokens SET attempts=attempts+1 WHERE id=?`, [record.id]);

  const inputHash = hashToken(token.trim());
  if (inputHash !== record.token_hash) {
    return { valid: false, reason: 'invalid_token' };
  }

  // Mark used
  await run(`UPDATE otp_tokens SET used=1 WHERE id=?`, [record.id]);
  return { valid: true };
}

module.exports = { createOTP, verifyOTP };
