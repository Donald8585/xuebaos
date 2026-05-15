# POST /api/palaces 500 — Post-Mortem

**Date:** 2026-05-15
**Incident:** POST https://api.xuebaos.com/api/palaces returns 500 after .docx/.pptx parsing
**Root cause:** H3 — Schema drift (confirmed). H2 — contributory (missing AI fields in zod).
**Duration:** Until migration applied + redeploy.

---

## Hypothesis Resolution

| # | Hypothesis | Verdict |
|---|-----------|---------|
| H1 | Body too large / parse failure | ❌ False (no guard existed, but not the active cause) |
| H2 | Schema validation throws unhandled | ⚠️ Contributory — zod was NOT rejecting extra fields, but also not accepting AI fields |
| **H3** | **D1 write failure — column missing** | ✅ **ROOT CAUSE** |
| H4 | Foreign key / userId missing | ❌ False — userId threaded correctly by authMiddleware |
| H5 | JSON column serialization | ❌ False — Drizzle `mode: "json"` handles serialization |
| H6 | Date / ID generation | ❌ False — crypto.randomUUID() + Date are fine in Workers |
| H7 | Downstream AI call inside POST | ❌ False — no AI call in POST handler |
| H8 | CPU / time limit | ❌ False — no evidence of CPU exceeded |

## Root Cause Detail

### The Missing Column
The Drizzle ORM schema (`db/schema.ts`) defined:
```typescript
loci: text("loci", { mode: "json" }).$type<LocusData[]>().default([]),
```

But the D1 migration SQL (`drizzle/schema.sql`) was **stale** and missing the `loci` column entirely:
```sql
-- memory_palaces had NO "loci" column
CREATE TABLE IF NOT EXISTS memory_palaces (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  name TEXT NOT NULL,
  description TEXT,
  subject TEXT,
  loci_count INTEGER DEFAULT 0,
  -- loci column MISSING! ← this gap caused the 500
  image_url TEXT,
  is_public INTEGER DEFAULT 0,
  ...
```

When the POST handler executed:
```typescript
await db.insert(db.schema.memoryPalaces).values({
  // ...
  loci: body.loci ?? [],  // ← Drizzle generates INSERT INTO ... (..., loci, ...)
});
```

Drizzle generated an INSERT statement referencing the non-existent `loci` column. D1 threw `SQLITE_ERROR: no such column: loci`, which bubbled through the catch-all error handler as a generic 500 with zero diagnostic context.

### Why GET worked but POST didn't
- `GET` reads from the table using `db.select().from(db.schema.memoryPalaces)` — Drizzle maps results to the ORM shape, silently ignoring missing columns in the result set (D1 just doesn't return data for that column).
- `POST` generates an INSERT statement that includes ALL columns defined in the Drizzle schema — and D1 rejects unknown columns.

### Why the .docx/.pptx change triggered it
Before the JSZip integration, the frontend sent simpler payloads without `loci` data (or with `loci: []`). The `loci` field existed in the Drizzle schema but was always empty, so the INSERT didn't fail on that specific column... 

Actually, the code ALWAYS sends `loci: body.loci ?? []`, so the INSERT always included the `loci` column. This means the 500 was **always latent** — any POST to /api/palaces would have failed since the column was added to the Drizzle schema but never migrated to D1. The JSZip changes just caused the first actual POST attempt since the schema was updated.

## What Was Fixed

### 1. Migration `0001_add_loci_column.sql`
```sql
ALTER TABLE memory_palaces ADD COLUMN loci TEXT DEFAULT '[]';
```

### 2. Migration `0002_add_palace_columns.sql`
```sql
ALTER TABLE memory_palaces ADD COLUMN slug TEXT DEFAULT '';
ALTER TABLE memory_palaces ADD COLUMN content_hash TEXT;
ALTER TABLE memory_palaces ADD COLUMN extras TEXT DEFAULT '{}';
UPDATE memory_palaces SET slug = 'palace-' || substr(id, 1, 8) WHERE slug IS NULL OR slug = '';
CREATE UNIQUE INDEX IF NOT EXISTS idx_palaces_user_slug ON memory_palaces(user_id, slug);
```

### 3. `db/schema.ts` — Added to `memoryPalaces` table
- `slug` (TEXT, NOT NULL, DEFAULT '')
- `contentHash` (TEXT)
- `extras` (TEXT, JSON mode) for `spatialMap`, `symbolicObjects`, `abbreviationChain`
- `uniqueIndex("idx_palaces_user_slug").on(table.userId, table.slug)`

### 4. `palaces.ts` — Rewritten POST handler
- **A.1 Body size guard**: 413 if `content-length` > 1MB
- **A.2 Structured zod validation**: 400 with `{ reason: "validation_failed", issues: [...] }`
- **B.1 Slug + content hash**: Slug from name, SHA-256 hash of payload for idempotency
- **B.2 Idempotency check**: Same (userId, slug, contentHash) → 200 with `__idempotent: true`; same slug, different hash → 409 `duplicate_slug`
- **B.3 Base64 image stripping**: Extracts `data:image/...;base64,...` from `symbolicObjects`, uploads to R2 under `palaces/{id}/symbols/{n}.{ext}`, stores only R2 keys in D1
- **B.4 Extras JSON**: Bundles `spatialMap`, `symbolicObjects`, `abbreviationChain` into single JSON TEXT column
- **B.5 Single D1 INSERT** with structured catch returning `classifyDbError` reason
- **B.6 Fetch-back with fallback**: Returns full record on success, minimal `{ id, name, slug }` if fetch-back fails

### 5. `lib/api.ts` — Frontend error handling
- Reads `body.reason`, `body.issues`, `body.requestId` from non-2xx responses
- `ApiError.reason`, `.issues`, `.requestId` exposed as public properties
- `ApiError.isRetryable` getter — false for 400/409/413

### 6. Error Classification (`classifyDbError`)
Maps D1/SQLite error codes and message patterns to structured reasons:
- `SQLITE_CONSTRAINT_UNIQUE` → `"unique_violation"`
- `SQLITE_CONSTRAINT_NOTNULL` → `"fk_violation"`
- `no such column` → `"schema_drift"`
- `unsupported type` → `"json_bind"`
- `Exceeded CPU` → `"cpu_exceeded"`
- Network/timeout → `"db_unavailable"`
- Default → `"unknown"` (logged, never silent)

## Guardrails Preventing Re-occurrence

1. **Schema drift detector**: Any Drizzle column not in D1 → `"schema_drift"` surfaced in response, not silent 500
2. **Body size gate**: 413 before any parse/DB work, worker CPU preserved
3. **Zod as contract**: All new AI fields (`spatialMap`, `symbolicObjects`, `abbreviationChain`) are explicitly validated; unknown fields are stripped by `.safeParse()` — no surprises reach the DB layer
4. **Structured failure log**: Every error emits `[palaces.create.fail]` with `{ userId, bodyBytes, reason, name, msg, sqliteCode, stack }` — `wrngler tail` grep `reason=unknown` now possible
5. **Test fixtures**: `minimal.json`, `full-ai.json`, `oversized.json` for quick curl verification post-deploy

## Deploy Steps

```bash
# 1. Run migrations (order matters)
cd apps/api
wrangler d1 execute xuebaos-db --file=./drizzle/migrations/0001_add_loci_column.sql
wrangler d1 execute xuebaos-db --file=./drizzle/migrations/0002_add_palace_columns.sql

# 2. Deploy worker
wrangler deploy

# 3. Verify
curl -i https://api.xuebaos.com/api/health

# 4. Smoke test with fixtures
curl -i -X POST https://api.xuebaos.com/api/palaces \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d @test/minimal.json
# Expect: 201 Created

curl -i -X POST https://api.xuebaos.com/api/palaces \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d @test/full-ai.json
# Expect: 201 Created (with extras populated)

# Same payload again → idempotent
curl -i -X POST https://api.xuebaos.com/api/palaces \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d @test/full-ai.json
# Expect: 200 OK with __idempotent: true

# Different name, same slug → conflict test
# (rename full-ai.json's name to match existing slug → 409)

# Oversized
curl -i -X POST https://api.xuebaos.com/api/palaces \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d @test/oversized.json
# Expect: 413 body_too_large

# Validation failure
curl -i -X POST https://api.xuebaos.com/api/palaces \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"name":""}'
# Expect: 400 validation_failed with issues[]
```
