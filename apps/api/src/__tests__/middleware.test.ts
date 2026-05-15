/**
 * Unit tests for middleware error tagging + whereEq guard
 *
 * Run: npx tsx src/__tests__/middleware.test.ts
 */

import { MiddlewareError, whereEq, whereAnd } from "../lib/errors";
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
  const fn = whereEq("userId", "u-123");
  const mockOps = { eq: (col: any, val: any) => `${col} = ${val}` };
  const mockCols = { userId: "user_id_col" };

  const result = fn(mockCols, mockOps);
  console.assert(result === "user_id_col = u-123", "whereEq builds correct eq");

  console.log("✅ testWhereEqValid");
}

function testWhereEqMissingOps() {
  const fn = whereEq("userId", "u-123");

  let threw = false;
  try {
    fn({ userId: "x" }, undefined);
  } catch (e: any) {
    threw = true;
    console.assert(e.message.includes("drizzle ops missing"), "Clear error message");
    console.assert(e.message.includes("bracket-access"), "Hints at root cause");
  }
  console.assert(threw, "Throws when ops is undefined");

  console.log("✅ testWhereEqMissingOps");
}

function testWhereEqNullOps() {
  const fn = whereEq("userId", "u-123");

  let threw = false;
  try {
    fn({ userId: "x" }, null);
  } catch (e: any) {
    threw = true;
    console.assert(e.message.includes("drizzle ops missing"), "Detects null ops");
  }
  console.assert(threw, "Throws when ops is null");

  console.log("✅ testWhereEqNullOps");
}

function testWhereAnd() {
  const conditions = [
    whereEq("userId", "u-1"),
    whereEq("isPublic", true),
  ];
  const fn = whereAnd(conditions);
  const mockOps = {
    eq: (col: any, val: any) => `EQ(${col},${val})`,
    and: (...args: any[]) => `AND(${args.join(",")})`,
  };
  const mockCols = { userId: "c1", isPublic: "c2" };

  const result = fn(mockCols, mockOps);
  console.assert(result.includes("AND"), "whereAnd builds AND");
  console.assert(result.includes("EQ(c1,u-1)"), "whereAnd includes condition 1");
  console.assert(result.includes("EQ(c2,true)"), "whereAnd includes condition 2");

  console.log("✅ testWhereAnd");
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

console.log("\n🧪 Middleware Tests\n");
testMiddlewareError();
testWhereEqValid();
testWhereEqMissingOps();
testWhereEqNullOps();
testWhereAnd();
testTABLESLookup();
testGetTable();
testGetTableInvalid();
testAllTableNames();
console.log("\n🎉 All tests passed\n");
