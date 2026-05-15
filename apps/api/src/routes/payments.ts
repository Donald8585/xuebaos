import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { eq } from "drizzle-orm";
import type { Env } from "../index";
import { authMiddleware } from "../middleware/auth";
import {
  createCheckoutSession,
  constructWebhookEvent,

  cancelSubscription,
  type TierKey,
} from "../services/stripe";

const payments = new Hono<{ Bindings: Env; Variables: Record<string, any> }>();

// ── Schemas ──────────────────────────────────────────────────────
const checkoutSchema = z.object({
  tier: z.enum(["xueba", "xueshen"]),
  successUrl: z.string().url(),
  cancelUrl: z.string().url(),
});

// ════════════════════════════════════════════════════════════════
// POST /api/payments/checkout — Create Stripe Checkout session
// ════════════════════════════════════════════════════════════════
payments.post("/checkout", authMiddleware, zValidator("json", checkoutSchema), async (c) => {
  const internalUserId = c.get("internalUserId");
  const { tier, successUrl, cancelUrl } = c.req.valid("json");

  try {
    const session = await createCheckoutSession(
      c.env,
      internalUserId,
      tier as TierKey,
      successUrl,
      cancelUrl
    );

    // Record pending payment
    const db = c.get("db");
    await db.insert(db.schema.payments).values({
      id: crypto.randomUUID(),
      userId: internalUserId,
      stripeSessionId: session.id,
      amount: 0, // Will be filled by webhook
      currency: "hkd",
      status: "pending",
      tier,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    return c.json({ url: session.url, sessionId: session.id });
  } catch (err) {
    console.error("Checkout error:", err);
    return c.json({ error: "Failed to create checkout session", details: String(err) }, 500);
  }
});

// ════════════════════════════════════════════════════════════════
// POST /api/payments/webhook — Stripe webhook handler
// ════════════════════════════════════════════════════════════════
payments.post("/webhook", async (c) => {
  const signature = c.req.header("stripe-signature");
  if (!signature) {
    return c.json({ error: "Missing stripe-signature header" }, 400);
  }

  const body = await c.req.text();

  try {
    const event = await constructWebhookEvent(c.env, body, signature);
    const db = c.get("db");

    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as any;
        const userId = session.metadata?.userId;
        const tier = session.metadata?.tier || "xueba";
        const subscriptionId = session.subscription as string;

        if (userId) {
          // Update user subscription
          const now = new Date();
          const subEnd = new Date();
          subEnd.setMonth(subEnd.getMonth() + 1); // 1-month default

          await db.update(db.schema.users)
            .set({
              subscriptionTier: tier,
              subscriptionEnds: subEnd,
              stripeCustomerId: session.customer as string,
              updatedAt: now,
            })
            .where(eq(db.schema.users.id, userId));

          // Update payment record
          await db.update(db.schema.payments)
            .set({
              status: "completed",
              stripeSubscriptionId: subscriptionId,
              amount: session.amount_total ? session.amount_total / 100 : 0,
              updatedAt: now,
            })
            .where(eq(db.schema.payments.stripeSessionId, session.id));
        }
        break;
      }

      case "customer.subscription.deleted": {
        const subscription = event.data.object as any;
        const customerId = subscription.customer as string;

        // Find user and downgrade to free
        const user = await db.query.users.findFirst({
          where: (u, { eq }) => eq(u.stripeCustomerId, customerId),
        });

        if (user) {
          await db.update(db.schema.users)
            .set({
              subscriptionTier: "free",
              subscriptionEnds: null,
              updatedAt: new Date(),
            })
            .where(eq(db.schema.users.id, user.id));
        }
        break;
      }

      case "invoice.payment_succeeded": {
        const invoice = event.data.object as any;
        const customerId = invoice.customer as string;
        const subscriptionId = invoice.subscription as string;

        if (subscriptionId && customerId) {
          const user = await db.query.users.findFirst({
            where: (u, { eq }) => eq(u.stripeCustomerId, customerId),
          });

          if (user) {
            const subEnd = new Date();
            subEnd.setMonth(subEnd.getMonth() + 1);

            await db.update(db.schema.users)
              .set({
                subscriptionEnds: subEnd,
                updatedAt: new Date(),
              })
              .where(eq(db.schema.users.id, user.id));

            // Record payment
            await db.insert(db.schema.payments).values({
              id: crypto.randomUUID(),
              userId: user.id,
              stripeSubscriptionId: subscriptionId,
              stripeInvoiceId: invoice.id,
              amount: invoice.amount_paid ? invoice.amount_paid / 100 : 0,
              currency: invoice.currency || "hkd",
              status: "completed",
              tier: user.subscriptionTier,
              createdAt: new Date(),
              updatedAt: new Date(),
            });
          }
        }
        break;
      }
    }

    return c.json({ received: true });
  } catch (err) {
    console.error("Webhook error:", err);
    return c.json({ error: "Webhook processing failed", details: String(err) }, 400);
  }
});

// ════════════════════════════════════════════════════════════════
// GET /api/payments/status — Get subscription status
// ════════════════════════════════════════════════════════════════
payments.get("/status", authMiddleware, async (c) => {
  const internalUserId = c.get("internalUserId");
  const db = c.get("db");

  const user = await db.query.users.findFirst({
    where: (u, { eq }) => eq(u.id, internalUserId),
  });

  if (!user) return c.json({ error: "User not found" }, 404);

  // Get recent payments
  const recentPayments = await db
    .select()
    .from(db.schema.payments)
    .where(eq(db.schema.payments.userId, internalUserId))
    .orderBy(db.schema.payments.createdAt)
    .limit(10);

  return c.json({
    tier: user.subscriptionTier,
    subscriptionEnds: user.subscriptionEnds,
    isActive: user.subscriptionEnds ? new Date(user.subscriptionEnds) > new Date() : false,
    recentPayments,
  });
});

// ════════════════════════════════════════════════════════════════
// POST /api/payments/cancel — Cancel subscription
// ════════════════════════════════════════════════════════════════
payments.post("/cancel", authMiddleware, async (c) => {
  const internalUserId = c.get("internalUserId");
  const db = c.get("db");

  const user = await db.query.users.findFirst({
    where: (u, { eq }) => eq(u.id, internalUserId),
  });

  if (!user) return c.json({ error: "User not found" }, 404);

  // Find active subscription from payments table
  const activePayment = await db.query.payments.findFirst({
    where: (p, { eq, and }) =>
      and(
        eq(p.userId, internalUserId),
        eq(p.status, "completed")
      ),
  });

  if (activePayment?.stripeSubscriptionId) {
    try {
      await cancelSubscription(c.env, activePayment.stripeSubscriptionId);
    } catch (err) {
      console.error("Cancel subscription error:", err);
      return c.json({ error: "Failed to cancel subscription", details: String(err) }, 500);
    }
  }

  // Downgrade to free
  await db.update(db.schema.users)
    .set({
      subscriptionTier: "free",
      subscriptionEnds: null,
      updatedAt: new Date(),
    })
    .where(eq(db.schema.users.id, internalUserId));

  return c.json({ success: true, tier: "free" });
});

export default payments;
