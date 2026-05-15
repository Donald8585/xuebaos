-- Migration 0004: M1.3 Walkthrough recording + M2 schemas
-- Run AFTER 0003_sprint0_m1.sql

-- M1.3: Walkthrough recording
CREATE TABLE IF NOT EXISTS walkthroughs (
  id TEXT PRIMARY KEY,
  palace_id TEXT NOT NULL REFERENCES memory_palaces(id),
  user_id TEXT NOT NULL REFERENCES users(id),
  duration_ms INTEGER DEFAULT 0,
  transcript TEXT,                    -- JSONB: array of {locusIndex, action, ts}
  audio_key TEXT,                     -- R2 key for recorded narration
  recall_score REAL,                  -- 0-100 AI-graded accuracy
  loci_visited INTEGER DEFAULT 0,
  loci_correct INTEGER DEFAULT 0,
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE INDEX IF NOT EXISTS idx_walkthroughs_user ON walkthroughs(user_id);
CREATE INDEX IF NOT EXISTS idx_walkthroughs_palace ON walkthroughs(palace_id);

-- M2.2: Chat conversations
CREATE TABLE IF NOT EXISTS chats (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  title TEXT NOT NULL DEFAULT 'New Chat',
  messages TEXT NOT NULL DEFAULT '[]', -- JSONB: array of {role, content, ts}
  context_palace_id TEXT REFERENCES memory_palaces(id),
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE INDEX IF NOT EXISTS idx_chats_user ON chats(user_id);

-- M2.3: Concept chains
CREATE TABLE IF NOT EXISTS concept_chains (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  root_concept TEXT NOT NULL,
  chain_json TEXT NOT NULL DEFAULT '{}', -- JSONB: { nodes: [{id, label, level}], edges: [{source, target, relation}] }
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE INDEX IF NOT EXISTS idx_concept_chains_user ON concept_chains(user_id);

-- Rollback:
-- DROP INDEX IF EXISTS idx_concept_chains_user;
-- DROP TABLE IF EXISTS concept_chains;
-- DROP INDEX IF EXISTS idx_chats_user;
-- DROP TABLE IF EXISTS chats;
-- DROP INDEX IF EXISTS idx_walkthroughs_palace;
-- DROP INDEX IF EXISTS idx_walkthroughs_user;
-- DROP TABLE IF EXISTS walkthroughs;
