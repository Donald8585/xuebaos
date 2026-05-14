import { Hono } from "hono";
import { eq } from "drizzle-orm";
import type { Env } from "../index";

const clerkWebhook = new Hono<{ Bindings: Env; Variables: Record<string, any> }>();

/**
 * POST /api/clerk/webhook
 *
 * Clerk sends webhook events to this endpoint when users sign up,
 * update their profile, or are deleted.
 *
 * Set this URL in Clerk Dashboard → Webhooks:
 *   https://api.xuebaos.com/api/clerk/webhook
 *
 * Events handled:
 *   - user.created  → insert user into D1
 *   - user.updated  → update username/email/avatar in D1
 *   - user.deleted  → soft-delete (set subscriptionTier to "deleted")
 */

interface ClerkWebhookEvent {
  type: string;
  data: {
    id: string;
    email_addresses?: Array<{ email_address: string }>;
    username?: string;
    first_name?: string;
    last_name?: string;
    image_url?: string;
    created_at?: number;
    updated_at?: number;
  };
}

// Verify Clerk webhook signature using @clerk/backend
async function verifyClerkWebhook(
  env: Env,
  body: string,
  headers: Record<string, string>
): Promise<ClerkWebhookEvent> {
  // Clerk uses Svix for webhooks — the signing secret is set as CLERK_WEBHOOK_SECRET
  const svixId = headers["svix-id"];
  const svixTimestamp = headers["svix-timestamp"];
  const svixSignature = headers["svix-signature"];

  if (!svixId || !svixTimestamp || !svixSignature) {
    throw new Error("Missing Svix webhook headers");
  }

  const webhookSecret = env.CLERK_WEBHOOK_SECRET;
  if (!webhookSecret) {
    throw new Error("CLERK_WEBHOOK_SECRET not configured");
  }

  // Verify using Svix signature scheme
  const signedContent = `${svixId}.${svixTimestamp}.${body}`;

  // Import the secret as a CryptoKey
  const encoder = new TextEncoder();
  const keyData = encoder.encode(webhookSecret.split("_").pop() || webhookSecret);
  const key = await crypto.subtle.importKey(
    "raw",
    keyData,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["verify"]
  );

  // Each signature is v1,<base64>
  const signatures = svixSignature.split(" ");
  let verified = false;

  for (const sig of signatures) {
    const [, sigData] = sig.split(",");
    if (!sigData) continue;

    const sigBytes = Uint8Array.from(atob(sigData), (c) => c.charCodeAt(0));
    const isValid = await crypto.subtle.verify(
      "HMAC",
      key,
      sigBytes,
      encoder.encode(signedContent)
    );

    if (isValid) {
      verified = true;
      break;
    }
  }

  if (!verified) {
    throw new Error("Invalid webhook signature");
  }

  return JSON.parse(body) as ClerkWebhookEvent;
}

// ════════════════════════════════════════════════════════════════
// POST /api/clerk/webhook
// ════════════════════════════════════════════════════════════════
clerkWebhook.post("/webhook", async (c) => {
  const body = await c.req.text();
  const headers: Record<string, string> = {};
  c.req.raw.headers.forEach((value, key) => {
    headers[key] = value;
  });

  let event: ClerkWebhookEvent;
  try {
    event = await verifyClerkWebhook(c.env, body, headers);
  } catch (err) {
    console.error("Clerk webhook verification failed:", err);
    return c.json({ error: "Invalid signature" }, 401);
  }

  const db = c.get("db");
  const { type, data } = event;

  try {
    switch (type) {
      case "user.created": {
        const email = data.email_addresses?.[0]?.email_address || null;
        const username =
          data.username ||
          data.first_name ||
          email?.split("@")[0] ||
          "user";

        const isFounder = email === "fiverrkroft@gmail.com";

        // Check if user already exists (idempotency)
        const existing = await db.query.users.findFirst({
          where: (u: any, { eq }: any) => eq(u.clerkId, data.id),
        });

        if (!existing) {
          await db.insert(db.schema.users).values({
            id: crypto.randomUUID(),
            clerkId: data.id,
            email,
            username,
            avatarUrl: data.image_url || null,
            subscriptionTier: isFounder ? "xueshen" : "free",
            subscriptionEnds: isFounder ? new Date("2099-12-31") : null,
            createdAt: new Date(),
            updatedAt: new Date(),
          });
          console.log(`Clerk webhook: user.created → ${data.id} (${email})`);
        }
        break;
      }

      case "user.updated": {
        const email = data.email_addresses?.[0]?.email_address;
        const username = data.username || data.first_name;

        const updates: Record<string, unknown> = { updatedAt: new Date() };
        if (email) updates.email = email;
        if (username) updates.username = username;
        if (data.image_url) updates.avatarUrl = data.image_url;

        await db
          .update(db.schema.users)
          .set(updates)
          .where(eq(db.schema.users.clerkId, data.id));
        console.log(`Clerk webhook: user.updated → ${data.id}`);
        break;
      }

      case "user.deleted": {
        // Soft-delete: mark subscription as deleted, keep data for analytics
        await db
          .update(db.schema.users)
          .set({
            subscriptionTier: "deleted",
            updatedAt: new Date(),
          })
          .where(eq(db.schema.users.clerkId, data.id));
        console.log(`Clerk webhook: user.deleted → ${data.id}`);
        break;
      }

      default:
        console.log(`Clerk webhook: unhandled event type → ${type}`);
    }

    return c.json({ received: true });
  } catch (err) {
    console.error("Clerk webhook handler error:", err);
    return c.json({ error: "Webhook processing failed", details: String(err) }, 500);
  }
});

export default clerkWebhook;
