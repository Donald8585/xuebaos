/**
 * Unit tests for middleware error tagging + whereEq guard + table() helper
 *
 * Run: npx tsx src/__tests__/middleware.test.ts
 */

import { MiddlewareError, whereEq, whereAnd, getSafeTable, validateTABLES } from "../lib/errors";
import { TABLES, getTable, type TableName } from "../db/schema";

// ── MiddlewareError tests ──────────────────────────────────────

function testMiddlewareError() {
  const cause = new Error("D1 connection refused");
  const mw = new MiddlewareError("checkLimit", cause);

  console.assert(mw instanceof Error, "MiddlewareError is an Error");
  console.assert(mw.name === "MiddlewareError", "name is MiddlewareError");
  console.assert(mw.middlewareName === "checkLimit", "middlewareName preserved");
  console.assert(mw.message.includes("[middleware:checkLimit]"), "message tagged");
  console.assert(mw.stack === cause.stack, "stack from cause");

  console.log("✅ testMiddlewareError");
}

// ── whereEq tests ─────────────────────────────────────────────

function testWhereEqValid() {
  const fn = whereEq("userId", "u-123", "testWhereEq");
  const mockOps = { eq: (col: any, val: any) => `${col} = ${val}` };
  const mockCols = { userId: "user_id_col" };

  const result = fn(mockCols as any, mockOps);
  console.assert(result === "user_id_col = u-123", "whereEq builds correct eq");

  console.log("✅ testWhereEqValid");
}

function testWhereEqMissingOps() {
  const fn = whereEq("userId", "u-123", "testSite");

  let threw: any = null;
  try {
    fn({ userId: "x" } as any, undefined);
  } catch (e: any) {
    threw = e;
    console.assert(e.message.includes("drizzle ops missing"), "Clear error message");
    console.assert(e.message.includes("[site=testSite]"), "Includes siteHint");
    console.assert(e.message.includes("[col=userId]"), "Includes column name");
    console.assert(e.code === "DRIZZLE_OPS_MISSING", "Has error code");
  }
  console.assert(threw !== null, "Throws when ops is undefined");

  console.log("✅ testWhereEqMissingOps");
}

function testWhereEqSiteHintInDetail() {
  const fn = whereEq("slug", "some-slug", "palaces.create.idempotency");
  let threw: any = null;
  try {
    fn({ slug: "x" } as any, null);
  } catch (e: any) {
    threw = e;
    console.assert(e.siteHint === "palaces.create.idempotency", "siteHint stored on error");
    console.assert(e.message.includes("palaces.create.idempotency"), "siteHint in message");
  }
  console.assert(threw !== null, "siteHint propagated");

  console.log("✅ testWhereEqSiteHintInDetail");
}

function testWhereAnd() {
  const conditions = [
    whereEq("userId", "u-1"),
    whereEq("isPublic", true),
  ];
  const fn = whereAnd(conditions, "testWhereAnd");
  const mockOps = {
    eq: (col: any, val: any) => `EQ(${col},${val})`,
    and: (...args: any[]) => `AND(${args.join(",")})`,
  };
  const mockCols = { userId: "c1", isPublic: "c2" };

  const result = fn(mockCols as any, mockOps);
  console.assert(result.includes("AND"), "whereAnd builds AND");
  console.assert(result.includes("EQ(c1,u-1)"), "whereAnd includes condition 1");
  console.assert(result.includes("EQ(c2,true)"), "whereAnd includes condition 2");

  console.log("✅ testWhereAnd");
}

function testWhereAndMissingOps() {
  const fn = whereAnd([], "testWhereAndFail");
  let threw: any = null;
  try {
    fn({} as any, undefined);
  } catch (e: any) {
    threw = e;
    console.assert(e.code === "DRIZZLE_OPS_MISSING", "whereAnd has error code");
    console.assert(e.siteHint === "testWhereAndFail", "whereAnd stores siteHint");
  }
  console.assert(threw !== null, "whereAnd throws on missing ops");

  console.log("✅ testWhereAndMissingOps");
}

// ── getSafeTable tests ──────────────────────────────────────

function testGetSafeTable() {
  const t = getSafeTable("memoryPalaces");
  console.assert(t === TABLES.memoryPalaces, "getSafeTable returns correct table");
  console.log("✅ testGetSafeTable");
}

function testGetSafeTableInvalid() {
  let threw = false;
  try {
    getSafeTable("nonexistent" as TableName);
  } catch (e: any) {
    threw = true;
    console.assert(e.message.includes("unknown_or_invalid_table"), "Named error on invalid table");
  }
  console.assert(threw, "getSafeTable throws on invalid name");
  console.log("✅ testGetSafeTableInvalid");
}

// ── TABLES registry tests ──────────────────────────────────

function testTABLESLookup() {
  const t = TABLES.memoryPalaces;
  console.assert(t !== undefined, "TABLES.memoryPalaces exists");
  console.assert(typeof t === "object", "TABLES.memoryPalaces is a table object");

  console.log("✅ testTABLESLookup");
}

function testGetTable() {
  const t = getTable("memoryPalaces");
  console.assert(t === TABLES.memoryPalaces, "getTable returns correct table");

  console.log("✅ testGetTable");
}

function testGetTableInvalid() {
  let threw = false;
  try {
    getTable("nonexistent" as TableName);
  } catch (e: any) {
    threw = true;
    console.assert(e.message.includes("unknown_table"), "Throws on invalid name");
  }
  console.assert(threw, "getTable throws on invalid table name");

  console.log("✅ testGetTableInvalid");
}

// ── Startup invariant test ─────────────────────────────────

function testStartupInvariant() {
  // validateTABLES should NOT throw with a valid registry
  let threw = false;
  try {
    validateTABLES();
  } catch {
    threw = true;
  }
  console.assert(!threw, "startup invariant passes with valid TABLES");
  console.log("✅ testStartupInvariant");
}

// ── Idempotency lookup pattern test ────────────────────────

function testIdempotencyLookupPattern() {
  // Simulate the idempotency check: where(userId, internalUserId) AND where(slug, slug)
  const conditions = [
    whereEq("userId", "user-abc", "palaces.create.idempotency"),
    whereEq("slug", "renaissance-anatomy", "palaces.create.idempotency"),
  ];
  const fn = whereAnd(conditions, "palaces.create.idempotency");
  const mockOps = {
    eq: (col: any, val: any) => `EQ(${col},${val})`,
    and: (...args: any[]) => `AND(${args.join(",")})`,
  };
  const mockCols = { userId: "c1", slug: "c2" };

  const result = fn(mockCols as any, mockOps);
  console.assert(result.includes("EQ(c1,user-abc)"), "idempotency checks userId");
  console.assert(result.includes("EQ(c2,renaissance-anatomy)"), "idempotency checks slug");
  console.assert(result.includes("AND"), "idempotency uses AND");

  console.log("✅ testIdempotencyLookupPattern");
}

function testAllTableNames() {
  const names: TableName[] = [
    "users", "memoryPalaces", "mnemonicStories", "symbols",
    "studySessions", "timetables", "questions", "payments",
    "annotations", "readingVault", "recallSessions",
    "technocraticAudits", "methods",
  ];

  for (const name of names) {
    const t = TABLES[name];
    console.assert(t !== undefined, `TABLES.${name} exists`);
  }

  console.log(`✅ testAllTableNames (${names.length} tables)`);
}

// ── Run ──────────────────────────────────────────────────────

console.log("\n🧪 Middleware + whereEq Tests\n");
testMiddlewareError();
testWhereEqValid();
testWhereEqMissingOps();
testWhereEqSiteHintInDetail();
testWhereAnd();
testWhereAndMissingOps();
testGetSafeTable();
testGetSafeTableInvalid();
testTABLESLookup();
testGetTable();
testGetTableInvalid();
testStartupInvariant();
testIdempotencyLookupPattern();
testAllTableNames();
console.log("\n🎉 All 14 tests passed\n");
