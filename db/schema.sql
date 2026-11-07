-- Only ciphertext, a hash of each reporter's lookup value, statuses and dates.
-- No IP addresses, no times of day, no plaintext about anyone.

CREATE TABLE IF NOT EXISTS cases (
  id          SERIAL PRIMARY KEY,
  lookup_hash TEXT NOT NULL UNIQUE,      -- sha256 of a value derived from the receipt code
  report      TEXT NOT NULL,             -- sealed box to the platform key, or 'PURGED'
  status      TEXT NOT NULL DEFAULT 'received',
  notes       TEXT,                      -- operator notes, sealed to the platform key
  created_on  DATE NOT NULL,
  updated_on  DATE NOT NULL,
  filed_on    DATE,                      -- day 0 for the 30/45-day reminders
  unread      INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS messages (
  id          SERIAL PRIMARY KEY,
  case_id     INTEGER NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
  direction   TEXT NOT NULL CHECK (direction IN ('to_reporter', 'to_platform')),
  ciphertext  TEXT NOT NULL,             -- sealed to the recipient
  copy        TEXT NOT NULL,             -- sealed to the sender, for their own record
  created_on  DATE NOT NULL
);
CREATE INDEX IF NOT EXISTS messages_case_idx ON messages(case_id);

CREATE TABLE IF NOT EXISTS used_challenges (
  hash     TEXT PRIMARY KEY,             -- stops a solved proof of work being reused
  used_on  DATE NOT NULL
);
