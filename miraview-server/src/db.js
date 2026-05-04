'use strict';

const Database = require('better-sqlite3');
const path = require('path');

const DB_PATH = process.env.DB_PATH || path.join('/data', 'miraview-reads.db');

const db = new Database(DB_PATH);

db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id       INTEGER PRIMARY KEY,
    username TEXT NOT NULL UNIQUE,
    password TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS sessions (
    token      TEXT PRIMARY KEY,
    user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS reads (
    id         INTEGER PRIMARY KEY,
    user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    vault_name TEXT NOT NULL,
    doc_path   TEXT NOT NULL,
    last_read  INTEGER NOT NULL,
    read_count INTEGER NOT NULL DEFAULT 1,
    UNIQUE(user_id, vault_name, doc_path)
  );

  CREATE INDEX IF NOT EXISTS idx_reads_user_vault ON reads(user_id, vault_name);

  CREATE TABLE IF NOT EXISTS quiz_runs (
    id         INTEGER PRIMARY KEY,
    user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    vault_name TEXT NOT NULL,
    doc_path   TEXT NOT NULL,
    quiz_id    TEXT NOT NULL,
    run_at     INTEGER NOT NULL,
    score      INTEGER NOT NULL,
    total      INTEGER NOT NULL
  );

  CREATE INDEX IF NOT EXISTS idx_quiz_runs_user_vault ON quiz_runs(user_id, vault_name, doc_path);
`);

function bootstrapUsers() {
  const raw = process.env.AUTH_USERS || '';
  if (!raw.trim()) return;
  const insert = db.prepare('INSERT OR IGNORE INTO users (username, password) VALUES (?, ?)');
  for (const pair of raw.split(',')) {
    const [username, ...rest] = pair.trim().split(':');
    const password = rest.join(':');
    if (username && password) insert.run(username, password);
  }
}

const stmts = {
  getUserByUsername: db.prepare('SELECT * FROM users WHERE username = ?'),
  getSession:        db.prepare('SELECT s.*, u.username FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.token = ?'),
  insertSession:     db.prepare('INSERT INTO sessions (token, user_id, created_at) VALUES (?, ?, ?)'),
  deleteSession:     db.prepare('DELETE FROM sessions WHERE token = ?'),
  upsertRead: db.prepare(`
    INSERT INTO reads (user_id, vault_name, doc_path, last_read, read_count)
    VALUES (?, ?, ?, ?, 1)
    ON CONFLICT(user_id, vault_name, doc_path) DO UPDATE SET
      last_read  = excluded.last_read,
      read_count = read_count + 1
    RETURNING read_count, last_read
  `),
  getRead: db.prepare('SELECT read_count, last_read FROM reads WHERE user_id = ? AND vault_name = ? AND doc_path = ?'),
  getReadsByVault: db.prepare('SELECT doc_path, read_count, last_read FROM reads WHERE user_id = ? AND vault_name = ?'),
  insertQuizRun: db.prepare(`
    INSERT INTO quiz_runs (user_id, vault_name, doc_path, quiz_id, run_at, score, total)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `),
  getLastQuizRun: db.prepare(`
    SELECT quiz_id, run_at, score, total FROM quiz_runs
    WHERE user_id = ? AND vault_name = ? AND doc_path = ?
    ORDER BY run_at DESC LIMIT 1
  `),
  getQuizRunHistory: db.prepare(`
    SELECT quiz_id, run_at, score, total FROM quiz_runs
    WHERE user_id = ? AND vault_name = ? AND doc_path = ?
    ORDER BY run_at DESC
  `),
};

module.exports = { db, bootstrapUsers, stmts };
