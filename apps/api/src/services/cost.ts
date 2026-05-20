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
  free: 5.0,       // ~1,300 tokens = ~5KB text (small essay)
  xueba: 20.0,     // ~5,200 tokens = ~20KB (chapter)
  pro: 50.0,       // ~13,000 tokens = ~52KB (paper)
  founder: 200.0,   // ~52,000 tokens = ~208KB (thesis chapter)
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
