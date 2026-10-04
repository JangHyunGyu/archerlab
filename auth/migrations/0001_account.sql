PRAGMA foreign_keys = ON;
CREATE TABLE users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  created_at INTEGER NOT NULL
);
CREATE TABLE identities (
  provider TEXT NOT NULL CHECK (provider IN ('email', 'google')),
  subject TEXT NOT NULL,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  PRIMARY KEY (provider, subject)
);
CREATE TABLE sessions (
  hash TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  origin TEXT NOT NULL,
  parent_hash TEXT REFERENCES sessions(hash) ON DELETE CASCADE,
  expires_at INTEGER NOT NULL,
  created_at INTEGER NOT NULL
);
CREATE INDEX sessions_parent ON sessions(parent_hash);
CREATE INDEX sessions_expiry ON sessions(expires_at);
CREATE TABLE sso_requests (
  hash TEXT PRIMARY KEY,
  browser_hash TEXT NOT NULL,
  origin TEXT NOT NULL,
  return_path TEXT NOT NULL,
  expires_at INTEGER NOT NULL
);
CREATE TABLE sso_codes (
  hash TEXT PRIMARY KEY,
  request_hash TEXT NOT NULL REFERENCES sso_requests(hash) ON DELETE CASCADE,
  parent_hash TEXT NOT NULL REFERENCES sessions(hash) ON DELETE CASCADE,
  expires_at INTEGER NOT NULL
);
CREATE TABLE oauth_flows (
  hash TEXT PRIMARY KEY,
  browser_hash TEXT NOT NULL,
  nonce TEXT NOT NULL,
  verifier TEXT NOT NULL,
  sso_request TEXT,
  expires_at INTEGER NOT NULL
);
CREATE TABLE pending_google (
  browser_hash TEXT PRIMARY KEY,
  subject TEXT NOT NULL,
  email TEXT NOT NULL,
  name TEXT NOT NULL,
  sso_request TEXT,
  expires_at INTEGER NOT NULL
);
CREATE TABLE email_challenges (
  hash TEXT PRIMARY KEY,
  browser_hash TEXT NOT NULL,
  email TEXT NOT NULL,
  signature TEXT NOT NULL,
  attempts INTEGER NOT NULL DEFAULT 0,
  expires_at INTEGER NOT NULL,
  sso_request TEXT
);
CREATE INDEX email_browser ON email_challenges(browser_hash);
CREATE TABLE rate_limits (
  key TEXT PRIMARY KEY,
  count INTEGER NOT NULL,
  expires_at INTEGER NOT NULL
);
