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
 * Bracket access on module namespaces can return
 * undefined-shaped proxies in esbuild/wrangler bundles, which causes
 * Drizzle's .where((cols, { eq }) => ...) to receive undefined as
 * the second argument ("ops"). This wrapper guards against that:
 *
 *   db.select().from(table).where(whereEq("userId", uid))
 *
 * If ops is missing, it throws "drizzle ops missing — table arg invalid"
 * instead of the cryptic "Cannot destructure property 'eq' of undefined".
 */
export function whereEq(col: string, value: unknown) {
  return (_cols: any, ops: any) => {
    if (!ops?.eq) {
      throw new Error("drizzle ops missing — table arg may be invalid (bracket-access on module namespace?)");
    }
    return ops.eq(_cols[col], value);
  };
}

/**
 * Safe Drizzle .where callback for compound AND conditions.
 */
export function whereAnd(conditions: Array<(_cols: any, ops: any) => any>) {
  return (_cols: any, ops: any) => {
    if (!ops?.and) {
      throw new Error("drizzle ops missing — table arg may be invalid (bracket-access on module namespace?)");
    }
    return ops.and(...conditions.map(c => c(_cols, ops)));
  };
}
