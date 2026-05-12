const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

const dbPath = process.env.DB_PATH || './data/app.db';
const dbDir = path.dirname(dbPath);

if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

const db = new sqlite3.Database(dbPath);

function run(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function (err) {
      if (err) reject(err);
      else resolve({ lastID: this.lastID, changes: this.changes });
    });
  });
}

function get(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });
}

function all(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
}

async function migrate() {
  await run('PRAGMA journal_mode=WAL');
  await run('PRAGMA foreign_keys=ON');

  await run(`
    CREATE TABLE IF NOT EXISTS otp_tokens (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      session_id TEXT NOT NULL,
      token_hash TEXT NOT NULL,
      expires_at INTEGER NOT NULL,
      attempts INTEGER DEFAULT 0,
      used INTEGER DEFAULT 0,
      created_at INTEGER DEFAULT (strftime('%s','now'))
    )
  `);

  await run(`
    CREATE TABLE IF NOT EXISTS reset_sessions (
      id TEXT PRIMARY KEY,
      identifier_hash TEXT NOT NULL,
      ad_username TEXT,
      otp_verified INTEGER DEFAULT 0,
      factor2_verified INTEGER DEFAULT 0,
      ip TEXT,
      user_agent TEXT,
      created_at INTEGER DEFAULT (strftime('%s','now')),
      expires_at INTEGER NOT NULL
    )
  `);

  await run(`
    CREATE TABLE IF NOT EXISTS user_factors (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      ad_username TEXT NOT NULL UNIQUE,
      personal_email_enc TEXT,
      phone_enc TEXT,
      security_question_1 TEXT,
      security_answer_1_hash TEXT,
      security_question_2 TEXT,
      security_answer_2_hash TEXT,
      birth_date_hash TEXT,
      created_at INTEGER DEFAULT (strftime('%s','now')),
      updated_at INTEGER DEFAULT (strftime('%s','now'))
    )
  `);

  await run(`
    CREATE TABLE IF NOT EXISTS audit_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      timestamp INTEGER DEFAULT (strftime('%s','now')),
      ip TEXT,
      user_agent TEXT,
      identifier TEXT,
      step TEXT,
      success INTEGER,
      failure_reason TEXT,
      ad_username TEXT,
      session_id TEXT
    )
  `);

  await run(`
    CREATE TABLE IF NOT EXISTS rate_limit_blocks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      key TEXT NOT NULL,
      block_until INTEGER NOT NULL,
      attempts INTEGER DEFAULT 0,
      created_at INTEGER DEFAULT (strftime('%s','now'))
    )
  `);

  await run(`CREATE INDEX IF NOT EXISTS idx_otp_session ON otp_tokens(session_id)`);
  await run(`CREATE INDEX IF NOT EXISTS idx_sessions_id ON reset_sessions(id)`);
  await run(`CREATE INDEX IF NOT EXISTS idx_audit_timestamp ON audit_log(timestamp)`);
  await run(`CREATE INDEX IF NOT EXISTS idx_user_factors_username ON user_factors(ad_username)`);
}

module.exports = { db, run, get, all, migrate };
