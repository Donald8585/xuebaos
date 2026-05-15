import type { Context, Next } from "hono";
import type { Env } from "../index";

const FOUNDER_EMAIL = "fiverrkroft@gmail.com";

/**
 * Lightweight JWT verification using Web Crypto + JWKS from clerk.xuebaos.com.
 * No @clerk/backend dependency — works natively in Cloudflare Workers.
 */
async function verifyClerkToken(token: string, secretKey: string | undefined): Promise<{ sub: string; email?: string }> {
  // 1. Parse JWT
  const parts = token.split(".");
  if (parts.length !== 3) throw Object.assign(new Error("Invalid JWT format"), { reason: "invalid_token" });

  const header = JSON.parse(atob(parts[0]));
  const payload = JSON.parse(atob(parts[1]));
  const signature = parts[2];

  const kid = header.kid;
  if (!kid) throw Object.assign(new Error("No kid in JWT header"), { reason: "invalid_token" });

  // 2. Validate expiration
  const now = Math.floor(Date.now() / 1000);
  if (payload.exp && now >= payload.exp) {
    throw Object.assign(new Error("Token expired"), { reason: "expired" });
  }
  if (payload.nbf && now < payload.nbf) {
    throw Object.assign(new Error("Token not yet valid"), { reason: "not_yet_valid" });
  }

  // 3. Validate issuer
  const iss = payload.iss;
  if (!iss || !iss.includes("clerk.xuebaos.com")) {
    throw Object.assign(new Error(`Invalid issuer: ${iss}`), { reason: "invalid_issuer" });
  }

  // 4. Validate authorized party
  const azp = payload.azp;
  if (azp && !["https://xuebaos.com"].includes(azp)) {
    throw Object.assign(new Error(`Invalid azp: ${azp}`), { reason: "azp_mismatch" });
  }

  // 4. Fetch JWKS from clerk.xuebaos.com (known reachable)
  const jwksResp = await fetch("https://clerk.xuebaos.com/.well-known/jwks.json");
  if (!jwksResp.ok) throw Object.assign(new Error(`JWKS fetch failed: ${jwksResp.status}`), { reason: "clerk_unreachable" });
  const jwks = await jwksResp.json() as { keys: Array<Record<string, string>> };
  const jwk = jwks.keys.find((k) => k.kid === kid);
  if (!jwk) throw new Error(`Key ${kid} not found in JWKS`);

  // 5. Import public key via Web Crypto (native in Workers)
  const cryptoKey = await crypto.subtle.importKey(
    "jwk",
    { kty: jwk.kty, n: jwk.n, e: jwk.e, alg: jwk.alg || "RS256" },
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["verify"]
  );

  // 6. Verify signature
  const sigBytes = base64UrlDecode(signature) as unknown as ArrayBuffer;
  const data = new TextEncoder().encode(`${parts[0]}.${parts[1]}`);
  const valid = await crypto.subtle.verify(
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    cryptoKey,
    sigBytes,
    data
  );

  if (!valid) throw new Error("Invalid token signature");

  return {
    sub: payload.sub,
    email: payload.email || payload.primary_email_address,
  };
}

function base64UrlDecode(str: string): Uint8Array {
  const base64 = str.replace(/-/g, "+").replace(/_/g, "/");
  const pad = "=".repeat((4 - (base64.length % 4)) % 4);
  const raw = atob(base64 + pad);
  const bytes = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
  return bytes;
}

export async function authMiddleware(
  c: Context<{ Bindings: Env; Variables: Record<string, any> }>,
  next: Next
) {
  const authHeader = c.req.header("Authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return c.json({ error: "unauthorized", reason: "no_token" }, 401);
  }
  const token = authHeader.slice(7);
  if (!token) return c.json({ error: "unauthorized", reason: "no_token" }, 401);

  try {
    const { sub: clerkUserId, email } = await verifyClerkToken(token, c.env.CLERK_SECRET_KEY);
    if (!clerkUserId) throw new Error("No sub in token");

    c.set("clerkUserId", clerkUserId);
    c.set("userId", clerkUserId);

    const db = c.get("db") as any;
    if (db) {
      let user = await db.query.users.findFirst({
        where: (u: any, { eq }: any) => eq(u.clerkId, clerkUserId),
      });
      const isFounder = email === FOUNDER_EMAIL;

      if (!user) {
        const id = crypto.randomUUID();
        await db.insert(db.schema.users).values({
          id, clerkId: clerkUserId, email: email || null,
          subscriptionTier: isFounder ? "xueshen" : "free",
          subscriptionEnds: isFounder ? new Date("2099-12-31") : null,
        });
        if (isFounder) console.log(`🐉 Founder: ${email}`);
        c.set("internalUserId", id);
        c.set("userTier", isFounder ? "xueshen" : "free");
      } else {
        if (isFounder && user.subscriptionTier !== "xueshen") {
          await db.update(db.schema.users).set({
            subscriptionTier: "xueshen", subscriptionEnds: new Date("2099-12-31"), updatedAt: new Date(),
          }).where((u: any, { eq }: any) => eq(u.clerkId, clerkUserId));
        }
        c.set("internalUserId", user.id);
        c.set("userTier", isFounder ? "xueshen" : (user.subscriptionTier || "free"));
      }
    }
    await next();
  } catch (err: any) {
    console.error("[AUTH]", err?.message, err?.reason);
    const isServerError = (err?.message || '').includes('import') ||
      (err?.message || '').includes('Unrecognized') ||
      (err?.message || '').includes('JWKS fetch');
    const status = isServerError ? 500 : 401;
    const reason = err?.reason || (isServerError ? 'server_error' : 'unknown');
    return c.json({ error: isServerError ? 'server_error' : 'unauthorized', reason, message: err?.message }, status);
  }
}

export async function optionalAuth(
  c: Context<{ Bindings: Env; Variables: Record<string, any> }>,
  next: Next
) {
  const authHeader = c.req.header("Authorization");
  if (authHeader && authHeader.startsWith("Bearer ")) {
    const token = authHeader.slice(7);
    if (token) {
      try {
        const { sub } = await verifyClerkToken(token, c.env.CLERK_SECRET_KEY);
        if (sub) {
          c.set("clerkUserId", sub);
          const db = c.get("db") as any;
          if (db) {
            const user = await db.query.users.findFirst({
              where: (u: any, { eq }: any) => eq(u.clerkId, sub),
            });
            if (user) {
              c.set("internalUserId", user.id);
              c.set("userTier", user.subscriptionTier || "free");
            }
          }
        }
      } catch { /* proceed without auth */ }
    }
  }
  await next();
}
