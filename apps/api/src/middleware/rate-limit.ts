import type { Context, Next } from "hono";
import type { Env } from "../index";
import { MiddlewareError } from "../lib/errors";

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

/**
 * Simple in-memory rate limiter backed by KV.
 * Falls back to in-memory if KV not available.
 */
const memoryStore = new Map<string, RateLimitEntry>();

export function rateLimiter(maxRequests: number = 60, windowSeconds: number = 60) {
  return async (c: Context<{ Bindings: Env }>, next: Next) => {
    const requestId = crypto.randomUUID();
    try {
      const key = `rate:${c.req.header("CF-Connecting-IP") || c.req.header("X-Forwarded-For") || "unknown"}`;
      const now = Math.floor(Date.now() / 1000);

      let entry: RateLimitEntry | undefined;

      if (c.env.CACHE) {
        try {
          const raw = await c.env.CACHE.get(key);
          if (raw) {
            entry = JSON.parse(raw);
          }
        } catch {
          // KV miss, fallthrough to memory
        }
      }

      if (!entry) {
        entry = memoryStore.get(key);
      }

      if (entry && entry.resetAt > now && entry.count >= maxRequests) {
        return c.json(
          { error: "Rate limit exceeded", retryAfter: entry.resetAt - now },
          429
        );
      }

      if (!entry || entry.resetAt <= now) {
        entry = { count: 0, resetAt: now + windowSeconds };
      }

      entry.count++;

      // Persist to KV (best-effort) and memory
      memoryStore.set(key, entry);
      if (c.env.CACHE) {
        try {
          await c.env.CACHE.put(key, JSON.stringify(entry), {
            expirationTtl: windowSeconds,
          });
        } catch {
          // non-critical
        }
      }

      // Add rate-limit headers
      c.res.headers.set("X-RateLimit-Limit", String(maxRequests));
      c.res.headers.set("X-RateLimit-Remaining", String(maxRequests - entry.count));
      c.res.headers.set("X-RateLimit-Reset", String(entry.resetAt));

      await next();
    } catch (e: any) {
      const wrapped = new MiddlewareError("rateLimiter", e);
      console.error("[rateLimit.fail]", JSON.stringify({
        requestId,
        msg: String(e?.message ?? "").slice(0, 200),
        name: e?.name,
      }));
      return c.json({
        error: "internal_error",
        reason: "middleware:rateLimiter",
        stage: "middleware",
        detail: String(e?.message ?? "").slice(0, 200),
        requestId,
      }, 500);
    }
  };
}
