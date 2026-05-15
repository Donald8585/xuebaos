-- Migration 0003: Sprint 0 infra + M1.1 spatial_map column
-- Run AFTER 0002_add_palace_columns.sql

-- M1.1: Spatial map layout data for drag-to-arrange
-- Stores per-locus position within the palace room plan
ALTER TABLE memory_palaces ADD COLUMN spatial_map TEXT DEFAULT '[]';

-- M1.2: Loci symbols map (keyed by locus index → symbol metadata)
-- { "0": { imageKey, prompt, style, generatedAt, model }, ... }
ALTER TABLE memory_palaces ADD COLUMN loci_symbols TEXT DEFAULT '{}';

-- Sprint 0: AI generation job tracking
CREATE TABLE IF NOT EXISTS ai_jobs (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  job_type TEXT NOT NULL,           -- 'symbol_gen', 'spatial_suggest', 'narration', 'export'
  status TEXT NOT NULL DEFAULT 'queued', -- queued, processing, completed, failed
  payload TEXT,                      -- JSON: input parameters
  result TEXT,                       -- JSON: output data
  error TEXT,                        -- error message if failed
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE INDEX IF NOT EXISTS idx_ai_jobs_user_status ON ai_jobs(user_id, status);

-- Rollback:
-- DROP INDEX IF EXISTS idx_ai_jobs_user_status;
-- DROP TABLE IF EXISTS ai_jobs;
-- ALTER TABLE memory_palaces DROP COLUMN spatial_map;
-- ALTER TABLE memory_palaces DROP COLUMN loci_symbols;
