import type { Context, Next } from "hono";
import type { Env } from "../index";
import { verifyToken } from "@clerk/backend";

// Founder email — permanent xueshen tier, never expires
const FOUNDER_EMAIL = "fiverrkroft@gmail.com";

/**
 * Clerk JWT authentication middleware using @clerk/backend verifyToken.
 */
export async function authMiddleware(
  c: Context<{ Bindings: Env; Variables: Record<string, any> }>,
  next: Next
) {
  const authHeader = c.req.header("Authorization");

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return c.json({ error: "Missing or invalid Authorization header" }, 401);
  }

  const token = authHeader.slice(7);
  if (!token) {
    return c.json({ error: "Empty token" }, 401);
  }

  try {
    const result = await verifyToken(token, {
      secretKey: c.env.CLERK_SECRET_KEY,
      apiUrl: "https://clerk.xuebaos.com",
      authorizedParties: ["https://xuebaos.com"],
    });

    const clerkUserId = (result.payload as any).sub;
    if (!clerkUserId) throw new Error("No sub in verified token");

    c.set("clerkUserId", clerkUserId);
    c.set("userId", clerkUserId);

    // Find or create internal user
    const db = c.get("db") as any;
    if (db) {
      let user = await db.query.users.findFirst({
        where: (u: any, { eq }: any) => eq(u.clerkId, clerkUserId),
      });

      const email = (result.payload as any).email || undefined;
      const isFounder = email === FOUNDER_EMAIL;

      if (!user) {
        const userId = crypto.randomUUID();
        await db.insert(db.schema.users).values({
          id: userId,
          clerkId: clerkUserId,
          email: email || null,
          subscriptionTier: isFounder ? "xueshen" : "free",
          subscriptionEnds: isFounder ? new Date("2099-12-31") : null,
        });
        if (isFounder) console.log(`🐉 Founder account created: ${email}`);
        c.set("internalUserId", userId);
        c.set("userTier", isFounder ? "xueshen" : "free");
      } else {
        if (isFounder && user.subscriptionTier !== "xueshen") {
          await db.update(db.schema.users)
            .set({ subscriptionTier: "xueshen", subscriptionEnds: new Date("2099-12-31"), updatedAt: new Date() })
            .where((u: any, { eq }: any) => eq(u.clerkId, clerkUserId));
        }
        c.set("internalUserId", user.id);
        const effectiveTier = isFounder ? "xueshen" : (user.subscriptionTier || "free");
        c.set("userTier", effectiveTier);
      }
    }

    await next();
  } catch (err: any) {
    console.error('[AUTH_DEBUG]', JSON.stringify({
      message: err?.message,
      name: err?.name,
      reason: err?.reason,
      code: err?.code,
      status: err?.status,
      stack: err?.stack?.slice(0, 300),
    }));
    return c.json({
      error: 'Authentication failed',
      debug: err?.message || 'Unknown error',
    }, 401);
  }
}

/**
 * Optional auth — attaches user if token is present, but does not reject.
 */
export async function optionalAuth(
  c: Context<{ Bindings: Env; Variables: Record<string, any> }>,
  next: Next
) {
  const authHeader = c.req.header("Authorization");

  if (authHeader && authHeader.startsWith("Bearer ")) {
    const token = authHeader.slice(7);
    if (token) {
      try {
        const result = await verifyToken(token, {
          secretKey: c.env.CLERK_SECRET_KEY,
      apiUrl: "https://clerk.xuebaos.com",
          authorizedParties: ["https://xuebaos.com"],
        });
        const clerkUserId = (result.payload as any).sub;
        if (clerkUserId) {
          c.set("clerkUserId", clerkUserId);
          c.set("userId", clerkUserId);

          const db = c.get("db") as any;
          if (db) {
            const user = await db.query.users.findFirst({
              where: (u: any, { eq }: any) => eq(u.clerkId, clerkUserId),
            });
            if (user) {
              c.set("internalUserId", user.id);
              c.set("userTier", user.subscriptionTier || "free");
            }
          }
        }
      } catch { /* token invalid — proceed without auth */ }
    }
  }

  await next();
}
