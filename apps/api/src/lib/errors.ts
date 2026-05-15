/**
 * Middleware error tagging + Drizzle .where callback safety.
 *
 * Every middleware that wraps its body in try/catch should emit a
 * MiddlewareError so the top-level boundary can tag the response with
 * { reason: "middleware:<name>", stage: "middleware" }.
 */

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
 *   db.select().from(table).where(whereEq("userId", uid, "checkLimit"))
 *
 * If ops is missing, it throws a named error including the callerTag:
 *   "drizzle ops missing — table arg may be invalid [caller: checkLimit]"
 *
 * @param col - column name (dot-access on cols, not bracket)
 * @param value - value to compare
 * @param callerTag - human-readable tag for crash identification without stack
 */
export function whereEq(col: string, value: unknown, callerTag?: string) {
  return (_cols: any, ops: any) => {
    if (!ops?.eq) {
      const detail = callerTag ? ` [caller: ${callerTag}]` : "";
      throw new Error(
        `drizzle ops missing — table arg may be invalid (bracket-access on module namespace?)${detail}`
      );
    }
    return ops.eq(_cols[col], value);
  };
}

/**
 * Safe Drizzle .where callback for compound AND conditions.
 */
export function whereAnd(conditions: Array<(_cols: any, ops: any) => any>, callerTag?: string) {
  return (_cols: any, ops: any) => {
    if (!ops?.and) {
      const detail = callerTag ? ` [caller: ${callerTag}]` : "";
      throw new Error(
        `drizzle ops missing — table arg may be invalid (bracket-access on module namespace?)${detail}`
      );
    }
    return ops.and(...conditions.map(c => c(_cols, ops)));
  };
}
