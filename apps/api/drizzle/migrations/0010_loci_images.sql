-- ============================================================================
-- Migration 0010: loci_images — AI-generated images for memory palace loci
-- ============================================================================
-- Phase 3: Wire Flux Schnell (Replicate) image generation per locus
-- Images generated asynchronously after loci extraction completes.
-- Tier-gated: free=5/month, xueshen=unlimited.

CREATE TABLE IF NOT EXISTS loci_images (
  id TEXT PRIMARY KEY,
  locus_index INTEGER NOT NULL,         -- index within the loci array
  palace_id TEXT REFERENCES memory_palaces(id),
  job_id TEXT REFERENCES loci_jobs(id),
  user_id TEXT NOT NULL REFERENCES users(id),
  concept TEXT NOT NULL,                 -- the locus concept text
  room_name TEXT,                        -- room context from spatial map
  prompt TEXT NOT NULL,                  -- the exact prompt sent to Replicate
  image_url TEXT,                        -- final image URL from Replicate
  r2_key TEXT,                           -- R2 key if we cache the image
  status TEXT NOT NULL DEFAULT 'pending', -- pending | generating | done | failed
  error TEXT,                            -- error message if failed
  generation_time_ms INTEGER,            -- how long generation took
  cost_cents REAL NOT NULL DEFAULT 0,    -- estimated cost in USD cents
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE INDEX IF NOT EXISTS idx_loci_images_palace ON loci_images(palace_id);
CREATE INDEX IF NOT EXISTS idx_loci_images_job ON loci_images(job_id);
CREATE INDEX IF NOT EXISTS idx_loci_images_user ON loci_images(user_id);
CREATE INDEX IF NOT EXISTS idx_loci_images_status ON loci_images(status);
