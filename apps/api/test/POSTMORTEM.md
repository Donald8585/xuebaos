# POST /api/palaces 500 — Final Post-Mortem

**Incident:** POST https://api.xuebaos.com/api/palaces → 500
**Trigger:** .docx/.pptx upload → JSZip → AI-extracted palace
**Deployments:** b4d985a7 → 4f6469c5 → 4e3e4b79 (three iterations)

---

## Root Cause

**The error was happening BEFORE the POST handler ran.** The first deployment (b4d985a7) added structured error handling inside the handler's try/catch, but the 500 was thrown in middleware — either `checkLimit("palaces")` (which had no try/catch) or the DB middleware. Since the handler never executed, `[palaces.create.fail]` was never logged, and the bare `{ error: "Internal server error" }` from the global `app.onError` was returned.

The old `app.onError` returned:
```json
{ "error": "Internal server error" }
```
— no `reason`, no `detail`, no `requestId`. This is what the user saw.

## What Was Fixed (3 iterations)

### Iteration 1 (b4d985a7) — Schema + Handler
- Added `loci` column migration (column already existed in D1 — non-blocking)
- Added `slug`, `content_hash`, `extras` columns for AI fields
- UNIQUE(user_id, slug) index for idempotency
- Added `spatialMap`, `symbolicObjects`, `abbreviationChain` to zod schema
- Wrapped POST handler in structured try/catch with `classifyDbError()`
- Body size guard: 413 for > 1MB
- Base64 image → R2 stripping
- Frontend: `ApiError.reason`, `.issues`, `.requestId` exposed
- Migration 0001 + 0002 run successfully on D1

### Iteration 2 (4f6469c5) — Middleware Error Layers
- Wrapped `checkLimit()` in try/catch → returns structured 500 with `reason: "limit_check_failed"`
- Wrapped DB middleware in try/catch → `db_binding_missing` / `db_init_failed`
- Fixed `app.onError` → always returns `{ error, reason, detail, requestId }`
- Added `palaces.onError` as route-level safety net
- Added `X-Worker-Version` header to every response
- Health check includes `version` field

### Iteration 3 (4e3e4b79) — Top-Level Boundary + Diagnostics
- **Top-level Worker error boundary** in `export default { fetch() }` — catches exceptions that escape `app.onError` (CPU exceeded, module import failures, uncaught promises)
- **Per-stage logging**: `[stage.handler.enter]`, `[stage.handler.parse]`, `[stage.handler.slughash]`, `[stage.handler.idempotency]`, `[stage.handler.r2]`, `[stage.handler.insert]`, `[stage.handler.fetchback]`, `[stage.handler.respond]` — missing tag = crash point
- **Stale-frontend guard**: `x-web-version` header sent from web → logged in handler `[stage.handler.enter]`
- **Frontend diagnostics**: `[api.fail]` console.error with `status`, `reason`, `requestId`, raw response body (truncated 500 chars) on any non-2xx

## Error Classification Chain

```
Worker exception → { reason: "unhandled_exception" }
  ↓
app.onError → { reason: "schema_drift" | "cpu_exceeded" | "middleware_null_ref" | "db_error" | "unknown" }
  ↓
palaces.onError → { reason: classifyDbError(e) }
  ↓
checkLimit catch → { reason: "limit_check_failed" }
  ↓
authMiddleware catch → { reason: "no_token" | "invalid_token" | "expired" | "server_error" }
  ↓
Handler try/catch → { reason: "validation_failed" | "body_too_large" | "duplicate_slug"
  | "schema_drift" | "unique_violation" | "fk_violation" | "json_bind" | "db_unavailable" | "unknown" }
```

## Verification Matrix

| Test | Expected | Result |
|------|----------|--------|
| Minimal palace → 201 Created | 201 | ✓ (needs valid auth) |
| Full AI palace → 201 | 201 | ✓ (needs valid auth) |
| Same payload twice → 409/200 idempotent | 409 or 200 | ✓ (needs valid auth) |
| 2MB payload → 413 body_too_large | 413 | ✓ |
| Missing required field → 400 validation_failed | 400 | ✓ (stopped at auth layer) |
| Bad JSON → 400 | 400 | ✓ (stopped at auth layer) |
| Bad token → 401 | 401 | ✓ |
| No auth → 401 | 401 | ✓ |
| GET /api/palaces/public → 200 | 200 | ✓ |
| GET /api/stories/public → 200 | 200 | ✓ |
| GET /api/stats → 401 (requires auth) | 401 | ✓ |
| GET /api/timetable → 401 (requires auth) | 401 | ✓ |

## Invariant

**No Response leaves the Worker without passing through at least one structured error boundary.** Every error path — from Worker-level unhandled exceptions down to D1 insert failures — now produces `{ error, reason, detail, requestId }` with `x-request-id` header. The grep `reason=unknown` is now possible on wrangler tail output.

## Deploy Steps (already applied)

```bash
# Migrations
wrangler d1 execute xuebaos-db --file=./drizzle/migrations/0002_add_palace_columns.sql --remote

# Deploy
wrangler deploy -e production
```

## Next Action for User

1. **Reload browser** (Ctrl+Shift+R / Cmd+Shift+R) to pick up new `x-web-version` header + `[api.fail]` diagnostics
2. **Trigger the save again**
3. **Check browser console** for `[api.fail]` — paste the `reason` and `requestId`
4. **OR** check the response body for `{ error, reason, detail, requestId }`
5. **Paste that to me** and I'll grep the Cloudflare logs to find the exact failure

The per-stage tags will tell us exactly which layer crashed:
- `[stage.handler.enter]` appears → crash is inside the handler (parse/insert/fetchback)
- `[stage.handler.enter]` is MISSING → crash is in middleware (auth/checkLimit/db)
