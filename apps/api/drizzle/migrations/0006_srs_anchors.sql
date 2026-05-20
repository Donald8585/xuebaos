-- Migration 0006: SRS-Anchored Loci
-- Adds palace_anchors table with FSRS scheduling for video-anchored memory loci

CREATE TABLE IF NOT EXISTS palace_anchors (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  palace_id TEXT NOT NULL REFERENCES memory_palaces(id),
  locus_index INTEGER NOT NULL,
  concept TEXT NOT NULL,
  source_video_id TEXT REFERENCES palace_videos(id),
  source_timestamp REAL,
  thumbnail_key TEXT,
  -- FSRS fields
  fsrs_stability REAL DEFAULT 0,
  fsrs_difficulty REAL DEFAULT 0.3,
  fsrs_state INTEGER DEFAULT 0,
  fsrs_due INTEGER,
  fsrs_elapsed_days INTEGER DEFAULT 0,
  fsrs_scheduled_days INTEGER DEFAULT 0,
  fsrs_reps INTEGER DEFAULT 0,
  fsrs_lapses INTEGER DEFAULT 0,
  fsrs_last_review INTEGER,
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE INDEX IF NOT EXISTS idx_palace_anchors_user ON palace_anchors(user_id);
CREATE INDEX IF NOT EXISTS idx_palace_anchors_palace ON palace_anchors(palace_id);
CREATE INDEX IF NOT EXISTS idx_palace_anchors_due ON palace_anchors(fsrs_due);
CREATE INDEX IF NOT EXISTS idx_palace_anchors_video ON palace_anchors(source_video_id);
