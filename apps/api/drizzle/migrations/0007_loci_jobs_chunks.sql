-- Migration 0007: Loci Job + Chunk tables for chunked generation pipeline
-- Supports arbitrarily large documents via chunked LLM processing

CREATE TABLE loci_jobs (
  id              TEXT PRIMARY KEY,
  user_id         TEXT NOT NULL REFERENCES users(id),
  file_name       TEXT,
  file_size       INTEGER NOT NULL DEFAULT 0,
  r2_key          TEXT,
  topic           TEXT,
  total_chunks    INTEGER NOT NULL DEFAULT 0,
  completed_chunks INTEGER NOT NULL DEFAULT 0,
  status          TEXT NOT NULL DEFAULT 'pending',  -- pending|parsing|generating|completed|failed
  error           TEXT,
  plaintext_length INTEGER NOT NULL DEFAULT 0,
  estimated_tokens INTEGER NOT NULL DEFAULT 0,
  created_at      INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at      INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE INDEX idx_loci_jobs_user ON loci_jobs(user_id, created_at DESC);

CREATE TABLE loci_chunks (
  id              TEXT PRIMARY KEY,
  job_id          TEXT NOT NULL REFERENCES loci_jobs(id),
  sequence_index  INTEGER NOT NULL,
  text            TEXT NOT NULL,
  token_count     INTEGER NOT NULL DEFAULT 0,
  section_title   TEXT,
  loci            TEXT,  -- JSON array of LocusData
  status          TEXT NOT NULL DEFAULT 'pending',  -- pending|processing|done|failed
  retry_count     INTEGER NOT NULL DEFAULT 0,
  error           TEXT,
  created_at      INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at      INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE INDEX idx_loci_chunks_job ON loci_chunks(job_id, sequence_index);
CREATE INDEX idx_loci_chunks_status ON loci_chunks(job_id, status);
