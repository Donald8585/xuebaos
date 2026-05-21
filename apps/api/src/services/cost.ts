/**
 * Cost estimation and cap enforcement for LLM calls.
 * DeepSeek v3 pricing (USD per 1M tokens): $0.27 input / $1.10 output.
 * In HKD (~7.8 rate): ~HK$0.0021 input / ~HK$0.0086 output per 1K tokens.
 */

// ── Pricing (HKD per 1K tokens) ──────────────────────────────────
const USD_TO_HKD = 7.8;

const PRICING: Record<string, { inputPer1K: number; outputPer1K: number }> = {
  "deepseek-chat": {
    inputPer1K: (0.27 / 1000) * USD_TO_HKD,   // ~HK$0.0021
    outputPer1K: (1.10 / 1000) * USD_TO_HKD,   // ~HK$0.0086
  },
  "deepseek-reasoner": {
    inputPer1K: (0.55 / 1000) * USD_TO_HKD,
    outputPer1K: (2.19 / 1000) * USD_TO_HKD,
  },
};

// ── Tier caps (HKD per job) ──────────────────────────────────────
const TIER_CAPS: Record<string, number> = {
  free: 5.0,          // ~1,300 tokens = ~5KB text (small essay)
  xueba: 20.0,        // ~5,200 tokens = ~20KB (chapter)
  pro: 50.0,          // ~13,000 tokens = ~52KB (paper)
  founder: 200.0,      // ~52,000 tokens = ~208KB (thesis chapter)
  xueshen: 999999,    // Unlimited — effectively no cap
};

/** Token estimator: ~4 chars per token for mixed text */
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

/** Estimate input cost for given token count and model */
export function estimateCost(inputTokens: number, model = "deepseek-chat"): number {
  const pricing = PRICING[model] ?? PRICING["deepseek-chat"];
  // Assume output ≈ 20% of input for loci generation
  const outputTokens = Math.ceil(inputTokens * 0.2);
  return (inputTokens * pricing.inputPer1K) + (outputTokens * pricing.outputPer1K);
}

/** Get cap for user tier */
export function getTierCap(tier?: string): number {
  return TIER_CAPS[tier ?? "free"] ?? TIER_CAPS.free;
}

/** Check if estimated cost exceeds tier cap. Returns { withinCap, estimatedCost, cap } */
export function checkCostCap(plaintext: string, tier?: string): {
  withinCap: boolean;
  estimatedCost: number;
  cap: number;
  estimatedTokens: number;
} {
  const estimatedTokens = estimateTokens(plaintext);
  const estimatedCost = estimateCost(estimatedTokens);
  const cap = getTierCap(tier);

  return {
    withinCap: estimatedCost <= cap,
    estimatedCost: Math.round(estimatedCost * 100) / 100,
    cap,
    estimatedTokens,
  };
}

/**
 * Track running cost for a job. Returns false if cap exceeded.
 * @param spentSoFar  HKD spent so far
 * @param nextChunkTokens  tokens in next chunk
 * @param tier  user tier
 */
export function trackJobCost(
  spentSoFar: number,
  nextChunkTokens: number,
  tier?: string
): { allowed: boolean; newTotal: number; cap: number } {
  const chunkCost = estimateCost(nextChunkTokens);
  const cap = getTierCap(tier);
  const newTotal = spentSoFar + chunkCost;

  return {
    allowed: newTotal <= cap,
    newTotal,
    cap,
  };
}

// ══════════════════════════════════════════════════════════════════
// Floor Plan Extraction — per-scan cost + per-tier monthly limits
// ══════════════════════════════════════════════════════════════════

/** Per-image cost via Flux Schnell (USD cents converted to HKD) */
export const IMAGE_GEN_COST_HKD = 0.023; // ~$0.003 USD × 7.8

/** Per-strategy cost per scan (HKD) */
const FLOOR_PLAN_COSTS: Record<string, number> = {
  dust3r_replicate: 0.40,  // ~$0.05 USD × 7.8
  gpt4o_vision: 0.16,      // ~$0.02 USD × 7.8
  default: 0.40,
};

/** Per-tier monthly scan limits */
const FLOOR_PLAN_MONTHLY_LIMITS: Record<string, number> = {
  free: 1,
  xueba: 10,
  pro: 50,
  founder: 100,
  xueshen: 999999,
};

/** Get cost for floor plan extraction by strategy */
export function getFloorPlanCost(strategy?: string): number {
  return FLOOR_PLAN_COSTS[strategy ?? "default"] ?? FLOOR_PLAN_COSTS.default;
}

/** Get monthly scan limit for tier */
export function getFloorPlanMonthlyLimit(tier?: string): number {
  return FLOOR_PLAN_MONTHLY_LIMITS[tier ?? "free"] ?? FLOOR_PLAN_MONTHLY_LIMITS.free;
}

/** Check if user has remaining floor plan scans this month */
export async function checkFloorPlanQuota(
  db: any,
  userId: string,
  tier?: string
): Promise<{ allowed: boolean; usedThisMonth: number; limit: number; costHkd: number }> {
  const limit = getFloorPlanMonthlyLimit(tier);
  if (limit >= 999999) return { allowed: true, usedThisMonth: 0, limit, costHkd: 0 };

  const { eq, and, sql } = await import("drizzle-orm");
  const thisMonthUnix = Math.floor(new Date(new Date().getFullYear(), new Date().getMonth(), 1).getTime() / 1000);

  const rows = await db.select({ count: sql`count(*)` })
    .from(db.schema.floorPlans)
    .where(and(
      eq(db.schema.floorPlans.userId, userId),
      sql`created_at >= ${thisMonthUnix}`
    ))
    .all();

  const usedThisMonth = Number(rows?.[0]?.count ?? 0);
  const costHkd = getFloorPlanCost();

  return { allowed: usedThisMonth < limit, usedThisMonth, limit, costHkd };
}
