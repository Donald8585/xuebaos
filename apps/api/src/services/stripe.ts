import type { Stripe } from "stripe";
import type { Env } from "../index";

// ── Pricing Tiers ──────────────────────────────────────────────────
export const PRICING_TIERS = {
  free: { priceId: null, name: "Free", maxPalaces: 1, maxStories: 5, maxQuestions: 10 },
  xueba: { priceId: "price_1TWs37GU9AFvFsl6mv9ZIZmx", name: "Xueba", amount: 79, currency: "hkd", maxPalaces: Infinity, maxStories: Infinity, maxQuestions: 100 },
  xueshen: { priceId: "price_1TWs38GU9AFvFsl6KNZAac7M", name: "Xueshen", amount: 159, currency: "hkd", maxPalaces: Infinity, maxStories: Infinity, maxQuestions: Infinity },
} as const;

export type TierKey = keyof typeof PRICING_TIERS;

let _StripeClass: any = null;

async function getStripeClass(): Promise<any> {
  if (_StripeClass) return _StripeClass;
  _StripeClass = (await import("stripe")).default;
  return _StripeClass;
}

export async function createStripeClient(env: Env): Promise<Stripe> {
  const StripeClass = await getStripeClass();
  return new StripeClass(env.STRIPE_SECRET_KEY, {
    apiVersion: "2024-06-20",
  });
}

export async function createCheckoutSession(
  env: Env,
  userId: string,
  tier: TierKey,
  successUrl: string,
  cancelUrl: string
) {
  const stripe = await createStripeClient(env);
  const tierConfig = PRICING_TIERS[tier];

  if (!tierConfig || tier === "free") {
    throw new Error("Invalid or free tier");
  }

  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    payment_method_types: ["card"],
    line_items: [
      {
        price: tierConfig.priceId as string,
        quantity: 1,
      },
    ],
    metadata: {
      userId,
      tier,
    },
    success_url: successUrl,
    cancel_url: cancelUrl,
  });

  return session;
}

export async function constructWebhookEvent(
  env: Env,
  body: string,
  signature: string
): Promise<Stripe.Event> {
  const stripe = await createStripeClient(env);
  return stripe.webhooks.constructEvent(
    body,
    signature,
    env.STRIPE_WEBHOOK_SECRET
  );
}

export async function retrieveSubscription(env: Env, subscriptionId: string) {
  const stripe = await createStripeClient(env);
  return stripe.subscriptions.retrieve(subscriptionId);
}

export async function cancelSubscription(env: Env, subscriptionId: string) {
  const stripe = await createStripeClient(env);
  return stripe.subscriptions.cancel(subscriptionId);
}
