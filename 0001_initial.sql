-- فتوى V2 — D1 schema
CREATE TABLE IF NOT EXISTS sources (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  authority TEXT NOT NULL,
  title TEXT NOT NULL,
  fatwa_number TEXT,
  issued_at TEXT,
  url TEXT NOT NULL,
  summary TEXT,
  content TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_sources_authority ON sources(authority);
CREATE INDEX IF NOT EXISTS idx_sources_issued_at ON sources(issued_at);

CREATE TABLE IF NOT EXISTS questions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  question TEXT NOT NULL,
  answer_json TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_questions_created_at ON questions(created_at);

-- Seed row intentionally omitted.
-- We will only insert sources after verifying their official origin and rights to use the data.
