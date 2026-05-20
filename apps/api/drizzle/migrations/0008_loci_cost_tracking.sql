-- Migration 0008: Add cost tracking to loci_jobs
ALTER TABLE loci_jobs ADD COLUMN cost_hkd REAL NOT NULL DEFAULT 0.0;
