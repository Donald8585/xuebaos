-- Migration 0001: Add loci column to memory_palaces
-- Fixes 500 on POST /api/palaces caused by schema drift
-- Drizzle schema defines loci as text("loci", { mode: "json" }) but D1 was missing the column

ALTER TABLE memory_palaces ADD COLUMN loci TEXT DEFAULT '[]';
