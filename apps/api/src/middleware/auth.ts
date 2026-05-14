import type { Context, Next } from "hono";
import type { Env } from "../index";

// Founder email — permanent xueshen tier, never expires
const FOUNDER_EMAIL = "fiverrkroft@gmail.com";

/**
 * Clerk JWT authentication middleware.
 * Verifies JWT tokens from Clerk using the JWKS endpoint.
 */
export async function authMiddleware(
  c: Context<{ Bindings: Env; Variables: { userId: string; clerkUserId: string; internalUserId: string; userTier: string; db: any } }>,
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
    // Verify token with Clerk JWKS
    const { sub: clerkUserId, email } = await verifyClerkJWT(c.env, token);

    c.set("clerkUserId", clerkUserId);
    c.set("userId", clerkUserId);

    // Find or create internal user
    const db = c.get("db") as any;
    if (db) {
      let user = await db.query.users.findFirst({
        where: (u: any, { eq }: any) => eq(u.clerkId, clerkUserId),
      });

      const isFounder = email === FOUNDER_EMAIL;

      if (!user) {
        const userId = crypto.randomUUID();
        await db.insert(db.schema.users).values({
          id: userId,
          clerkId: clerkUserId,
          email: email || null,
          subscriptionTier: isFounder ? "xueshen" : "free",
          // Founder: subscription set to year 2099 (= never expires)
          subscriptionEnds: isFounder ? new Date("2099-12-31") : null,
        });
        if (isFounder) console.log(`🐉 Founder account created: ${email}`);
        c.set("internalUserId", userId);
        c.set("userTier", isFounder ? "xueshen" : "free");
      } else {
        // If user exists but is founder and not xueshen, promote them
        if (isFounder && user.subscriptionTier !== "xueshen") {
          await db.update(db.schema.users)
            .set({
              subscriptionTier: "xueshen",
              subscriptionEnds: new Date("2099-12-31"),
              updatedAt: new Date(),
            })
            .where((u: any, { eq }: any) => eq(u.clerkId, clerkUserId));
        }
        c.set("internalUserId", user.id);
        const effectiveTier = isFounder ? "xueshen" : (user.subscriptionTier || "free");
        c.set("userTier", effectiveTier);
      }
    }

    await next();
  } catch (err: any) {
    console.error('[CLERK_AUTH_DEBUG]', JSON.stringify({
      message: err?.message,
      name: err?.name,
      reason: err?.reason,
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
  c: Context<{ Bindings: Env; Variables: { userId: string; clerkUserId: string; internalUserId: string; userTier: string; db: any } }>,
  next: Next
) {
  const authHeader = c.req.header("Authorization");

  if (authHeader && authHeader.startsWith("Bearer ")) {
    const token = authHeader.slice(7);
    if (token) {
      try {
        const { sub: clerkUserId } = await verifyClerkJWT(c.env, token);
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
      } catch {
        // Token invalid — proceed without auth
      }
    }
  }

  await next();
}

/**
 * Verify a Clerk session token using Clerk's REST API.
 * Works with Clerk v2 session tokens (NOT standard JWTs — Clerk session
 * tokens are opaque to the client and must be verified server-side).
 */
async function verifyClerkJWT(env: Env, token: string): Promise<{ sub: string; email?: string }> {
  // Clerk session tokens look like JWTs but use a custom signing mechanism.
  // The only reliable way to verify them is Clerk's own tokens/verify endpoint.
  // Try instance-specific endpoint first (works with custom Clerk domains)
  const verifyUrl = "https://clerk.xuebaos.com/v1/tokens/verify";
  const resp = await fetch(verifyUrl, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${env.CLERK_SECRET_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ token }),
  });

  if (!resp.ok) {
    const errText = await resp.text().catch(() => "unknown");
    console.error('[CLERK_VERIFY_FAIL]', JSON.stringify({ status: resp.status, body: errText.slice(0, 300), tokenPreview: token.slice(0, 20) + '...' }));
    throw new Error(`Clerk token verification failed (${resp.status}): ${errText.slice(0, 200)}`);
  }

  const data = await resp.json() as {
    sub?: string;
    user_id?: string;
    sid?: string;
    status?: string;
    payload?: Record<string, unknown>;
  };

  const userId = data.sub || data.user_id;
  if (!userId) throw new Error("Clerk verify response missing user_id");

  // Fetch email from Clerk for founder detection
  let email: string | undefined;
  try {
    const userResp = await fetch(`https://clerk.xuebaos.com/v1/users/${userId}`, {
      headers: { Authorization: `Bearer ${env.CLERK_SECRET_KEY}` },
    });
    if (userResp.ok) {
      const userData = await userResp.json() as {
        email_addresses?: Array<{ email_address: string }>;
      };
      email = userData.email_addresses?.[0]?.email_address;
    }
  } catch { /* best-effort email fetch */ }

  return { sub: userId, email };
}

