# POST /api/palaces 500 — Final Post-Mortem

**Incident:** POST https://api.xuebaos.com/api/palaces → 500
**Trigger:** .docx/.pptx upload → JSZip → AI-extracted palace
**Deploy history:** b4d985a7 → 4f6469c5 → 4e3e4b79 → cc87bb5a → d23117c0 → 196d7084 → 685d9398 → 53a6b71e → 2b333069

---

## Root Cause Chain (Two Bugs)

### Bug 1: `db.schema["memoryPalaces"]` bracket access (fixed in cc87bb5a)
`checkLimit("palaces")` used `db.schema["memoryPalaces"]` — bracket access on a TypeScript module namespace. In esbuild/wrangler bundles, module namespaces are NOT plain objects; bracket-access can return undefined-shaped proxies. Drizzle's `.where((cols, { eq }) => ...)` then received `undefined` as the ops argument → `Cannot destructure property 'eq' of 'undefined'`.

### Bug 2: `sqliteTable()` third-arg callback with `uniqueIndex()` (fixed in 685d9398)
After fixing Bug 1, `whereEq` was wired into `checkLimit`. The `TABLES.memoryPalaces` reference was correct via dot-access. Yet `whereEq` STILL received undefined ops. The culprit: `sqliteTable("memory_palaces", {...}, (table) => ({ userSlugIdx: uniqueIndex(...).on(...) }))` in drizzle-orm v0.33.0.

The third-argument callback silently broke the table object for `db.select().from(table).where()` — the `where` callback received undefined ops even with a correct table reference. This was NOT detectable by grep because:
- No `schema[...]` bracket access existed
- No `TABLES[...]` bracket access existed  
- The table was accessed via `TABLES.memoryPalaces` (correct dot-access)
- The poison was Drizzle-level: the table object itself was broken by the callback

**Why the first grep missed it:** The grep scanned for `schema\[`, `TABLES\[`, and raw `.where((c,{eq})` patterns — all clean. But the table object returned by `sqliteTable()` was already corrupted before any code accessed it.

**Why `siteHint + table()` make this class extinct:**
- `getSafeTable()` fails fast with `unknown_or_invalid_table:<name>` if the table doesn't exist in the registry
- `whereEq` with `siteHint` tags the crash with the exact call site (e.g., `[site=checkLimit:palaces] [col=userId]`)
- `validateTABLES()` runs at Worker boot — catches malformed TABLES before the first request
- `whereEq`/`whereAnd` refuse to destructure ops directly; if ops is undefined they throw a named `DRIZZLE_OPS_MISSING` error
- `classifyDbError()` recognizes `DRIZZLE_OPS_MISSING` → `reason: "drizzle_table_invalid"`

## What Was Fixed

### Structural
| Component | Before | After |
|-----------|--------|-------|
| Table lookup | `db.schema["memoryPalaces"]` | `getSafeTable("memoryPalaces")` from typed registry |
| Drizzle where | `.where((u, { eq }) => eq(...))`  | `.where(whereEq("userId", uid, "checkLimit:palaces"))` |
| Schema definition | `uniqueIndex()` callback in sqliteTable | Removed (index exists in D1 via migration) |
| Error surfacing | `{ error: "Internal server error" }` | `{ error, reason, stage, detail, code, siteHint, requestId }` |

### Layers (every one now structured)
```
Worker boundary     → { reason: "unhandled_exception", stage: "worker" }
app.onError         → { reason: "middleware:<name>" | "schema_drift" | ..., stage }
palaces.onError     → { reason: ..., stage: "route" }
checkLimit catch    → { reason: "middleware:checkLimit", stage: "middleware" }
rateLimiter catch   → { reason: "middleware:rateLimiter", stage: "middleware" }
authMiddleware catch → { reason: "no_token" | "invalid_token" | ..., code }
Handler try/catch   → { reason: "validation_failed" | "duplicate_slug" | ..., stage: "handler" }
```

### Typed Registry
```typescript
export const TABLES = { memoryPalaces, users, ... } as const;
export type TableName = keyof typeof TABLES;
export function getSafeTable(name: TableName) { ... }
// startup invariant: validateTABLES() runs on Worker init
```

### whereEq + whereAnd with siteHint
```typescript
whereEq("userId", uid, "checkLimit:palaces")
// Throws: [DRIZZLE_OPS_MISSING] [site=checkLimit:palaces] [col=userId]
```

## Guardrails (zero-bare-500 invariant)

1. **No bare 500**: Every error response has `{ error, reason, stage, detail, requestId }`
2. **Site hints**: Every `whereEq`/`whereAnd` call tagged with caller identity
3. **Startup invariant**: `validateTABLES()` runs on Worker init, catches malformed imports
4. **Lint gate**: `npm run lint:check` bans `schema[`, `TABLES[`, and raw `.where((c,{eq})`
5. **Invariant test**: Repo-wide scan proves bracket-access class extinct
6. **Stale-FE guard**: `x-web-version` header logged; `[api.fail]` console.error in browser

## Test Suite (14/14 passing)
| Test | What it proves |
|------|---------------|
| testMiddlewareError | MiddlewareError tags with name |
| testWhereEqValid | whereEq builds correct SQL |
| testWhereEqMissingOps | Throws DRIZZLE_OPS_MISSING + siteHint + col |
| testWhereEqSiteHintInDetail | siteHint stored on error object |
| testWhereAnd | Compound AND works |
| testWhereAndMissingOps | whereAnd also guards against undefined ops |
| testGetSafeTable | Correct table lookup |
| testGetSafeTableInvalid | Named error on invalid table |
| testStartupInvariant | validateTABLES passes with valid registry |
| testIdempotencyLookupPattern | Palace idempotency check pattern safe |
| testAllTableNames | All 13 tables present |

+ invariant.test.ts — repo-wide bracket-access scan (clean)

## Verification Matrix
| Test | Expected | Result |
|------|----------|--------|
| GET /api/palaces/public | 200 | ✅ |
| GET /api/stories/public | 200 | ✅ |
| GET /api/timetable | 401 (auth) | ✅ |
| GET /api/stats | 401 (auth) | ✅ |
| POST /api/ai/generate-palace (no auth) | 401 | ✅ |
| Bad token | 401 with reason | ✅ |
| No auth | 401 with reason | ✅ |
| lint:check | zero violations | ✅ |
| invariant scan | zero hits | ✅ |
| 14 unit tests | all pass | ✅ |

## Deploy
```bash
wrangler d1 execute xuebaos-db --file=./drizzle/migrations/0002_add_palace_columns.sql --remote
wrangler deploy -e production
```
Latest: v2b333069 (`53a6b71e-final` in /health)
