const { run } = require('../database');
const winston = require('winston');
require('winston-daily-rotate-file');
const path = require('path');
const fs = require('fs');

const logsDir = path.resolve(process.env.LOGS_DIR || '../logs');
if (!fs.existsSync(logsDir)) fs.mkdirSync(logsDir, { recursive: true });

const transport = new winston.transports.DailyRotateFile({
  filename: path.join(logsDir, 'audit-%DATE%.log'),
  datePattern: 'YYYY-MM-DD',
  maxFiles: '90d',
  zippedArchive: true,
});

const logger = winston.createLogger({
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [transport],
});

/**
 * @param {Object} opts
 * @param {string} opts.ip
 * @param {string} opts.userAgent
 * @param {string} opts.identifier   - sanitized (not full value, just type hint or partial hash)
 * @param {string} opts.step         - e.g. 'identification', 'otp_sent', 'otp_verify', 'factor2', 'password_reset'
 * @param {boolean} opts.success
 * @param {string} [opts.failureReason]
 * @param {string} [opts.adUsername]
 * @param {string} [opts.sessionId]
 */
async function audit(opts) {
  const {
    ip, userAgent, identifier = '', step, success,
    failureReason = null, adUsername = null, sessionId = null,
  } = opts;

  // Write to rotating file
  logger.info({
    ip,
    userAgent,
    identifier,
    step,
    success,
    failureReason,
    adUsername,
    sessionId,
  });

  // Write to SQLite for querying
  try {
    await run(
      `INSERT INTO audit_log (ip, user_agent, identifier, step, success, failure_reason, ad_username, session_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [ip, userAgent, identifier, step, success ? 1 : 0, failureReason, adUsername, sessionId]
    );
  } catch {
    // DB write failure must not crash the flow
  }
}

module.exports = { audit };
