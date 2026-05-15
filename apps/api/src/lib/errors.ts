/**
 * Middleware error tagging + Drizzle .where callback safety.
 *
 * Every middleware that wraps its body in try/catch should emit a
 * MiddlewareError so the top-level boundary can tag the response with
 * { reason: "middleware:<name>", stage: "middleware" }.
 */

import { TABLES, type TableName } from "../db/schema";

export class MiddlewareError extends Error {
  constructor(
    public middlewareName: string,
    cause: unknown,
  ) {
    const msg = (cause as any)?.message ?? String(cause);
    super(`[middleware:${middlewareName}] ${msg}`);
    this.name = "MiddlewareError";
    if ((cause as any)?.stack) {
      this.stack = (cause as any).stack;
    }
  }
}

/**
 * Safe Drizzle .where callback — never destructure { eq } directly.
 *
 * Bracket access on module namespaces can return undefined-shaped
 * proxies in esbuild/wrangler bundles, which causes Drizzle's
 * .where((cols, { eq }) => ...) to receive undefined as the second
 * argument ("ops"). This wrapper guards against that:
 *
 *   db.select().from(table).where(whereEq("userId", uid, "checkLimit:palaces"))
 *
 * If ops is missing, throws a named error:
 *   [DRIZZLE_OPS_MISSING] [site=checkLimit:palaces] [col=userId]
 *
 * @param col - column name (dot-access on cols object)
 * @param value - value to compare against
 * @param siteHint - human-readable tag for crash identification without stack
 */
export function whereEq<T = Record<string, unknown>>(
  col: keyof T & string,
  value: unknown,
  siteHint?: string,
) {
  return (cols: T, ops: any) => {
    if (!ops || typeof ops.eq !== "function") {
      const err = new Error(
        `drizzle ops missing — table arg may be invalid` +
        ` (bracket-access on module namespace?)` +
        (siteHint ? ` [site=${siteHint}]` : "") +
        ` [col=${String(col)}]`
      );
      (err as any).code = "DRIZZLE_OPS_MISSING";
      (err as any).siteHint = siteHint ?? null;
      throw err;
    }
    return ops.eq(cols[col], value);
  };
}

/**
 * Safe Drizzle .where callback for compound AND conditions.
 */
export function whereAnd<T = Record<string, unknown>>(
  conditions: Array<(_cols: any, ops: any) => any>,
  siteHint?: string,
) {
  return (cols: any, ops: any) => {
    if (!ops || typeof ops.and !== "function") {
      const err = new Error(
        `drizzle ops missing — table arg may be invalid` +
        ` (bracket-access on module namespace?)` +
        (siteHint ? ` [site=${siteHint}]` : "")
      );
      (err as any).code = "DRIZZLE_OPS_MISSING";
      (err as any).siteHint = siteHint ?? null;
      throw err;
    }
    return ops.and(...conditions.map(c => c(cols, ops)));
  };
}

/**
 * Typed table lookup — NEVER bracket-access db.schema or TABLES.
 * Fails fast with a named error if the table doesn't exist.
 *
 *   db.select().from(table("memoryPalaces"))
 */
export function getSafeTable(name: TableName) {
  const t = TABLES[name];
  if (!t || typeof t !== "object") {
    throw new Error(`unknown_or_invalid_table:${name}`);
  }
  return t;
}

/**
 * Startup invariant — runs once on Worker init.
 * Catches misconfigured imports before the first request.
 */
export function validateTABLES(): void {
  const names = Object.keys(TABLES) as TableName[];
  for (const name of names) {
    const t = TABLES[name];
    if (!t || typeof t !== "object") {
      throw new Error(`TABLES.${name} is not a Drizzle table`);
    }
  }
  if (names.length === 0) {
    throw new Error("TABLES registry is empty — check schema imports");
  }
}
