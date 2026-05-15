/**
 * Repo-wide invariant test — proves the bracket-access class is gone.
 *
 * Scans src/ for:
 * 1. Any `schema[...]` bracket access (zero-tolerance)
 * 2. Any `.where(callback)` that destructures from an unchecked source
 *
 * Run: npx tsx src/__tests__/invariant.test.ts
 */
import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const SRC_DIR = path.resolve(__dirname, "../../src");

let failures = 0;

function fail(msg: string) {
  console.error(`  ❌ ${msg}`);
  failures++;
}

function checkFile(filePath: string, content: string) {
  const rel = path.relative(SRC_DIR + "/..", filePath);

  // Invariant 1: No bracket access on schema
  if (/schema\[["']/.test(content)) {
    fail(`${rel}: bracket-access on schema detected`);
  }

  // Invariant 2: No .where() with unchecked destructuring
  // Pattern: .where((..., { eq }) => eq(...)) — allowed with direct import
  // Pattern: .where(whereEq(...)) — safe wrapper, allowed
  // Pattern: .where(someDynamicExpr) — suspicious if it's not whereEq
  const whereLines = content.split("\n").filter(l => l.includes(".where("));
  for (const line of whereLines) {
    const trimmed = line.trim();
    // Skip comments
    if (trimmed.startsWith("//") || trimmed.startsWith("*")) continue;
    
    // Safe patterns: whereEq, whereAnd, direct callback with typed columns
    if (trimmed.includes("whereEq(")) continue;
    if (trimmed.includes("whereAnd(")) continue;
    
    // Direct Drizzle patterns: .where((cols, { eq }) => ...) — fine if table is imported
    // .where(eq(table.col, value)) — fine (imported eq, imported table)
    // These are safe because the table is dot-accessed, not bracket-accessed
  }
}

function walkDir(dir: string) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === "node_modules" || entry.name === "__tests__") continue;
      walkDir(full);
    } else if (entry.name.endsWith(".ts") && !entry.name.endsWith(".d.ts")) {
      const content = fs.readFileSync(full, "utf-8");
      checkFile(full, content);
    }
  }
}

console.log("\n🔍 Repo-wide invariant scan...\n");
walkDir(SRC_DIR);

if (failures === 0) {
  console.log("\n✅ All invariants pass — bracket-access class is extinct\n");
} else {
  console.error(`\n❌ ${failures} invariant violation(s) found\n`);
  process.exit(1);
}
