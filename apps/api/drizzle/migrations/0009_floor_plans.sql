-- Migration 0009: Floor plans from home walkthrough videos
CREATE TABLE floor_plans (
  id              TEXT PRIMARY KEY,
  user_id         TEXT NOT NULL REFERENCES users(id),
  palace_id       TEXT REFERENCES memory_palaces(id),
  source_video_id TEXT REFERENCES palace_videos(id),
  source_video_key TEXT,     -- R2 key of the source walkthrough video
  room_schema     TEXT,      -- JSON: { rooms: [{ name, width_m, height_m, connections[] }] }
  status          TEXT NOT NULL DEFAULT 'pending',  -- pending|extracting|detecting|ready|failed
  error           TEXT,
  room_count      INTEGER NOT NULL DEFAULT 0,
  created_at      INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at      INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE INDEX idx_floor_plans_user ON floor_plans(user_id, created_at DESC);
