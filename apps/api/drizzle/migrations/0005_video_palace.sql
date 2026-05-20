-- Migration 0005: Video-backed Memory Palace
-- Adds palace_videos table for lecture recording uploads

CREATE TABLE IF NOT EXISTS palace_videos (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  palace_id TEXT REFERENCES memory_palaces(id),
  title TEXT NOT NULL,
  file_name TEXT,
  file_size INTEGER,
  duration_seconds REAL,
  r2_key TEXT NOT NULL,
  thumbnail_key TEXT,
  status TEXT DEFAULT 'uploading', -- uploading, processing, ready, failed
  scene_count INTEGER DEFAULT 0,
  scenes TEXT DEFAULT '[]', -- JSON array of {timestamp, thumbnailKey, label}
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE INDEX IF NOT EXISTS idx_palace_videos_user ON palace_videos(user_id);
CREATE INDEX IF NOT EXISTS idx_palace_videos_palace ON palace_videos(palace_id);
CREATE INDEX IF NOT EXISTS idx_palace_videos_status ON palace_videos(status);
