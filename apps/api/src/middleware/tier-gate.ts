import type { Context } from "hono";
import type { Env } from "../index";
import { PRICING_TIERS, type TierKey } from "../services/stripe";
import { TABLES, type TableName } from "../db/schema";
import { MiddlewareError, whereEq } from "../lib/errors";

/**
 * Tier gating middleware — enforce subscription limits across all endpoints.
 * 
 * Usage:
 *   import { requireTier, checkLimit } from "../middleware/tier-gate";
 *   
 *   // Require specific tier for premium features
 *   palaces.post("/", authMiddleware, requireTier("xueba"), ...);
 *   
 *   // Check resource-specific limits
 *   palaces.post("/", authMiddleware, checkLimit("palaces"), ...);
 */

/** Feature flags per tier — what each tier unlocks */
export const TIER_FEATURES: Record<TierKey, {
  imageGeneration: boolean;
  audioNarration: boolean;
  priorityAI: boolean;
  exportReports: boolean;
  customTemplates: boolean;
  aiChat: boolean;
}> = {
  free: {
    imageGeneration: false,
    audioNarration: false,
    priorityAI: false,
    exportReports: false,
    customTemplates: false,
    aiChat: false,
  },
  xueba: {
    imageGeneration: false,
    audioNarration: false,
    priorityAI: false,
    exportReports: false,
    customTemplates: false,
    aiChat: true,
  },
  xueshen: {
    imageGeneration: true,
    audioNarration: true,
    priorityAI: true,
    exportReports: true,
    customTemplates: true,
    aiChat: true,
  },
};

export function getTierFeatures(tier: string): typeof TIER_FEATURES.xueba {
  return TIER_FEATURES[tier as TierKey] || TIER_FEATURES.free;
}

export function getTierLimits(tier: string) {
  return PRICING_TIERS[tier as TierKey] || PRICING_TIERS.free;
}

/**
 * Middleware: require minimum tier level
 * Passes after checking user has at least the specified tier
 */
export function requireTier(minTier: TierKey) {
  const tierOrder: TierKey[] = ["free", "xueba", "xueshen"];

  return async (c: Context<{ Bindings: Env; Variables: Record<string, any> }>, next: () => Promise<void>) => {
    const internalUserId = c.get("internalUserId");
    const db = c.get("db");

    const user = await db.query.users.findFirst({
      where: (u: any, { eq }: any) => eq(u.id, internalUserId),
    });

    const userTier = (user?.subscriptionTier || "free") as TierKey;
    const hasActiveSub = user?.subscriptionEnds
      ? new Date(user.subscriptionEnds) > new Date()
      : false;

    // Treat expired subs as free
    const effectiveTier = hasActiveSub ? userTier : "free";

    if (tierOrder.indexOf(effectiveTier) < tierOrder.indexOf(minTier)) {
      return c.json({
        error: `This feature requires ${minTier} tier or higher.`,
        currentTier: effectiveTier,
        requiredTier: minTier,
        upgradeUrl: "/pricing",
      }, 402);
    }

    c.set("userTier", effectiveTier);
    await next();
  };
}

/**
 * Middleware: check feature flag access
 * Example: requireFeature("imageGeneration") → xueshen only
 */
export function requireFeature(feature: keyof typeof TIER_FEATURES.xueba) {
  return async (c: Context<{ Bindings: Env; Variables: Record<string, any> }>, next: () => Promise<void>) => {
    const internalUserId = c.get("internalUserId");
    const db = c.get("db");

    const user = await db.query.users.findFirst({
      where: (u: any, { eq }: any) => eq(u.id, internalUserId),
    });

    const userTier = (user?.subscriptionTier || "free") as TierKey;
    const hasActiveSub = user?.subscriptionEnds
      ? new Date(user.subscriptionEnds) > new Date()
      : false;

    const effectiveTier: TierKey = hasActiveSub ? userTier : "free";
    const features = TIER_FEATURES[effectiveTier] || TIER_FEATURES.free;

    if (!features[feature]) {
      return c.json({
        error: `"${feature}" is only available on the xueshen tier.`,
        currentTier: effectiveTier,
        upgradeUrl: "/pricing",
      }, 402);
    }

    c.set("userTier", effectiveTier);
    await next();
  };
}

/**
 * Middleware: check resource count against tier limits
 * Example: checkLimit("palaces") → checks user hasn't exceeded maxPalaces
 */
type ResourceType = "palaces" | "stories" | "questions";

const LIMIT_KEY_MAP: Record<ResourceType, "maxPalaces" | "maxStories" | "maxQuestions"> = {
  palaces: "maxPalaces",
  stories: "maxStories",
  questions: "maxQuestions",
};

// Direct table refs from typed registry — NEVER bracket-access db.schema
const RESOURCE_TABLE: Record<ResourceType, TableName> = {
  palaces: "memoryPalaces",
  stories: "mnemonicStories",
  questions: "questions",
};

export function checkLimit(resource: ResourceType) {
  const limitKey = LIMIT_KEY_MAP[resource];
  const tableName = RESOURCE_TABLE[resource];
  const table = TABLES[tableName];

  if (!table) throw new Error(`checkLimit: unknown table "${tableName}"`);

  return async (c: Context<{ Bindings: Env; Variables: Record<string, any> }>, next: () => Promise<void>) => {
    const requestId = crypto.randomUUID();
    try {
      const internalUserId = c.get("internalUserId");
      const db = c.get("db");

      const user = await db.query.users.findFirst({
        where: (u: any, { eq }: any) => eq(u.id, internalUserId),
      });

      const userTier = (user?.subscriptionTier || "free") as TierKey;
      const hasActiveSub = user?.subscriptionEnds
        ? new Date(user.subscriptionEnds) > new Date()
        : false;

      const effectiveTier: TierKey = hasActiveSub ? userTier : "free";
      const limits = PRICING_TIERS[effectiveTier];
      const maxAllowed = limits[limitKey];

      // Infinity = unlimited
      if (maxAllowed === Infinity) {
        c.set("userTier", effectiveTier);
        await next();
        return;
      }

      // Count current resources (dot-access only, whereEq guard)
      const allResources = await db.select().from(table)
        .where(whereEq("userId", internalUserId, "checkLimit"));

      let count = allResources.length;
      if (resource === "questions") {
        const now = new Date();
        const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
        count = allResources.filter((q: any) =>
          q.createdAt && new Date(q.createdAt) >= monthStart
        ).length;
      }

      if (count >= maxAllowed) {
        return c.json({
          error: `You've reached the ${effectiveTier} tier limit of ${maxAllowed} ${resource}.`,
          currentTier: effectiveTier,
          limit: maxAllowed,
          currentCount: count,
          upgradeUrl: "/pricing",
        }, 402);
      }

      c.set("userTier", effectiveTier);
      await next();
    } catch (e: any) {
      const wrapped = new MiddlewareError("checkLimit", e);
      console.error(`[checkLimit.${resource}.fail]`, JSON.stringify({
        requestId,
        msg: String(e?.message ?? "").slice(0, 300),
        name: e?.name,
        stack: e?.stack?.split("\n").slice(0, 5),
      }));
      return c.json({
        error: "internal_error",
        reason: "middleware:checkLimit",
        stage: "middleware",
        detail: String(e?.message ?? "").slice(0, 200),
        requestId,
      }, 500);
    }
  };
}
