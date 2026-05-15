-- Migration 0002: Add slug, content_hash, extras to memory_palaces
-- Supports idempotency, AI-extracted fields, and structured error recovery
-- Must run AFTER 0001_add_loci_column.sql

-- Add slug (auto-generated from name for idempotency)
ALTER TABLE memory_palaces ADD COLUMN slug TEXT DEFAULT '';
ALTER TABLE memory_palaces ADD COLUMN content_hash TEXT;
ALTER TABLE memory_palaces ADD COLUMN extras TEXT DEFAULT '{}';

-- Backfill slugs for existing rows using id substring (unique per-row)
UPDATE memory_palaces SET slug = 'palace-' || substr(id, 1, 8) WHERE slug IS NULL OR slug = '';

-- Enforce uniqueness on (user_id, slug) to prevent duplicates
CREATE UNIQUE INDEX IF NOT EXISTS idx_palaces_user_slug ON memory_palaces(user_id, slug);

-- Rollback:
-- DROP INDEX IF EXISTS idx_palaces_user_slug;
-- ALTER TABLE memory_palaces DROP COLUMN slug;
-- ALTER TABLE memory_palaces DROP COLUMN content_hash;
-- ALTER TABLE memory_palaces DROP COLUMN extras;
