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
  } catch (err) {
    console.error("Auth error:", err);
    return c.json({ error: "Authentication failed" }, 401);
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
 * Verify a Clerk-issued JWT against their JWKS endpoint.
 * Returns { sub: userId, email: primary email }.
 */
async function verifyClerkJWT(env: Env, token: string): Promise<{ sub: string; email?: string }> {
  // Decode JWT header to get kid
  const parts = token.split(".");
  if (parts.length !== 3) {
    throw new Error("Invalid JWT format");
  }

  const header = JSON.parse(atob(parts[0]));
  const kid = header.kid;
  if (!kid) throw new Error("No kid in JWT header");

  const payload = JSON.parse(atob(parts[1]));

  // Validate expiration
  if (payload.exp && Date.now() >= payload.exp * 1000) {
    throw new Error("Token expired");
  }

  // Fetch JWKS from Clerk — derive from token issuer or use env override
  const issuer = payload.iss || "https://clerk.xuebaos.com";
  const jwksUrl = env.CLERK_JWKS_URL || `${issuer}/.well-known/jwks.json`;
  const jwksResp = await fetch(jwksUrl);

  if (!jwksResp.ok) {
    throw new Error(`Failed to fetch JWKS: ${jwksResp.status}`);
  }

  const jwks = (await jwksResp.json()) as { keys: Array<Record<string, unknown>> };
  const key = jwks.keys.find((k) => k.kid === kid);

  if (!key) {
    throw new Error(`Key ${kid} not found in JWKS`);
  }

  // Verify signature using Web Crypto
  const cryptoKey = await importJWK(key);
  const isValid = await crypto.subtle.verify(
    { name: "RSASSA-PKCS1-v1.5", hash: "SHA-256" },
    cryptoKey,
    base64UrlToArrayBuffer(parts[2]), // signature
    new TextEncoder().encode(`${parts[0]}.${parts[1]}`) // signed data
  );

  if (!isValid) {
    throw new Error("Invalid token signature");
  }

  // Extract user ID from sub claim + email
  const sub = payload.sub;
  if (!sub) throw new Error("No subject claim in token");

  // Clerk JWT includes email in the payload
  const email = payload.email || payload.primary_email_address || undefined;

  return { sub, email };
}

async function importJWK(jwk: Record<string, unknown>): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    "jwk",
    {
      kty: jwk.kty as string,
      n: jwk.n as string,
      e: jwk.e as string,
      alg: jwk.alg as string,
    },
    { name: "RSASSA-PKCS1-v1.5", hash: "SHA-256" },
    false,
    ["verify"]
  );
}

function base64UrlToArrayBuffer(base64url: string): ArrayBuffer {
  const base64 = base64url.replace(/-/g, "+").replace(/_/g, "/");
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const binary = atob(base64 + padding);
  const buf = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    buf[i] = binary.charCodeAt(i);
  }
  return buf.buffer;
}
