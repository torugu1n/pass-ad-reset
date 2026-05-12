const crypto = require('crypto');

const ALGORITHM = 'aes-256-gcm';

function getKey() {
  const hex = process.env.ENCRYPTION_KEY || '';
  if (hex.length !== 64) throw new Error('ENCRYPTION_KEY must be 64 hex chars (32 bytes)');
  return Buffer.from(hex, 'hex');
}

function encrypt(plaintext) {
  const iv = crypto.randomBytes(12);
  const key = getKey();
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, encrypted]).toString('base64');
}

function decrypt(ciphertext) {
  const buf = Buffer.from(ciphertext, 'base64');
  const iv = buf.slice(0, 12);
  const tag = buf.slice(12, 28);
  const encrypted = buf.slice(28);
  const key = getKey();
  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(tag);
  return decipher.update(encrypted) + decipher.final('utf8');
}

function hash(value) {
  const salt = process.env.ENCRYPTION_KEY || 'default-salt';
  return crypto.createHmac('sha256', salt).update(value.toLowerCase().trim()).digest('hex');
}

function maskEmail(email) {
  const [local, domain] = email.split('@');
  if (!domain) return '***';
  const visible = local.length > 2 ? local[0] + '*'.repeat(local.length - 2) + local[local.length - 1] : '**';
  const [domainName, ext] = domain.split('.');
  const maskedDomain = domainName.length > 2
    ? domainName[0] + '*'.repeat(domainName.length - 2) + domainName[domainName.length - 1]
    : '**';
  return `${visible}@${maskedDomain}.${ext}`;
}

function maskPhone(phone) {
  if (!phone) return null;
  const digits = phone.replace(/\D/g, '');
  return '*'.repeat(Math.max(0, digits.length - 4)) + digits.slice(-4);
}

module.exports = { encrypt, decrypt, hash, maskEmail, maskPhone };
