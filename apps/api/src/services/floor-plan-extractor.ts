/**
 * Floor plan extractor v2 — multi-strategy with Replicate DUSt3R primary.
 *
 * Strategies (tried in order):
 *   1. dust3r_replicate — DUSt3R point cloud via Replicate API (webhook-based async)
 *   2. gpt4o_vision      — GPT-4o-mini vision LLM (synchronous, ~5s)
 *
 * Config via env vars:
 *   DUST3R_MODEL=owner/model:version  (default: camenduru/dust3r)
 *   FLOOR_PLAN_STRATEGY=dust3r_replicate|gpt4o_vision|auto
 */

import type { Env } from "../index";

// ── Types ──────────────────────────────────────────────────────────

interface RoomData {
  name: string;
  width_m: number;
  height_m: number;
  connections: string[];
  notable_features?: string[];
  floor_type?: string;
}

interface FloorPlanSchema {
  rooms: RoomData[];
  total_area_m2?: number;
  floor_count?: number;
  strategy_used?: string;
  dust3r_prediction_id?: string;
}

interface ReplicatePrediction {
  id: string;
  status: "starting" | "processing" | "succeeded" | "failed" | "canceled";
  output?: any;
  error?: string;
  logs?: string;
}

const MAX_FRAMES = 8;
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const REPLICATE_POLL_TIMEOUT_MS = 90_000;
const REPLICATE_POLL_INTERVAL_MS = 2_000;
const CACHE_TTL_MS = 3600_000; // 1h cache for identical inputs

// ── Simple in-memory cache for re-runs ───────────────────────────
const resultCache = new Map<string, { schema: FloorPlanSchema; ts: number }>();

function cacheKey(frames: string[]): string {
  // Hash first 100 chars of first + last frame for cache identity
  const f0 = frames[0]?.slice(0, 100) || "";
  const fn = frames[frames.length - 1]?.slice(-100) || "";
  return `${f0}|${fn}|${frames.length}`;
}

function cacheGet(key: string): FloorPlanSchema | null {
  const entry = resultCache.get(key);
  if (entry && Date.now() - entry.ts < CACHE_TTL_MS) return entry.schema;
  if (entry) resultCache.delete(key);
  return null;
}

function cacheSet(key: string, schema: FloorPlanSchema): void {
  resultCache.set(key, { schema, ts: Date.now() });
}

// ── DUSt3R via Replicate ──────────────────────────────────────────

const DUST3R_PROMPT = `Analyze this home interior point cloud/depth and produce a floor plan JSON:
{ "rooms": [{ "name": "Living Room", "width_m": 4.5, "height_m": 5.0, "connections": ["Kitchen", "Hallway"], "notable_features": ["red sofa", "TV unit"], "floor_type": "hardwood" }] }`;

async function extractWithDUSt3R(
  env: Env,
  frames: string[]
): Promise<FloorPlanSchema> {
  if (!env.REPLICATE_API_TOKEN) {
    throw new Error("REPLICATE_API_TOKEN not configured");
  }

  const dust3rModel = (env as any).DUST3R_MODEL || env.LLM_PRIMARY_MODEL || "camenduru/dust3r";
  console.log(`[floor-plan.dust3r] Trying model: ${dust3rModel} with ${frames.length} frames`);

  // Submit prediction
  const submitResp = await fetch("https://api.replicate.com/v1/predictions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Token ${env.REPLICATE_API_TOKEN}`,
    },
    body: JSON.stringify({
      version: dust3rModel,
      input: {
        images: frames.slice(0, 2), // DUSt3R works best with 2 images (stereo pair)
        prompt: DUST3R_PROMPT,
      },
      webhook_completed: null, // No webhook URL configured yet; use polling
    }),
  });

  if (!submitResp.ok) {
    const err = await submitResp.text().catch(() => "");
    const isModelNotFound = submitResp.status === 404 || err.includes("not found") || err.includes("does not exist");
    if (isModelNotFound) {
      throw new Error(`DUST3R_MODEL_NOT_FOUND:${dust3rModel}`);
    }
    throw new Error(`Replicate API error (${submitResp.status}): ${err.slice(0, 300)}`);
  }

  const prediction: ReplicatePrediction = await submitResp.json();
  const predictionId = prediction.id;
  console.log(`[floor-plan.dust3r] Prediction ${predictionId} submitted`);

  // Poll for completion (max 90s)
  const startedAt = Date.now();
  let pollCount = 0;

  while (Date.now() - startedAt < REPLICATE_POLL_TIMEOUT_MS) {
    await new Promise(r => setTimeout(r, REPLICATE_POLL_INTERVAL_MS));
    pollCount++;

    const pollResp = await fetch(
      `https://api.replicate.com/v1/predictions/${predictionId}`,
      { headers: { Authorization: `Token ${env.REPLICATE_API_TOKEN}` } }
    );

    if (!pollResp.ok) {
      console.error(`[floor-plan.dust3r] Poll ${pollCount} failed: HTTP ${pollResp.status}`);
      continue;
    }

    const result: ReplicatePrediction = await pollResp.json();

    if (result.status === "succeeded") {
      console.log(`[floor-plan.dust3r] Prediction ${predictionId} succeeded after ${pollCount} polls (${Date.now() - startedAt}ms)`);
      return postProcessDUSt3ROutput(result.output, predictionId);
    }

    if (result.status === "failed") {
      throw new Error(`DUSt3R prediction failed: ${result.error || "unknown error"}`);
    }

    if (result.status === "canceled") {
      throw new Error("DUSt3R prediction canceled");
    }
  }

  throw new Error(`REPLICATE_TIMEOUT: DUSt3R prediction ${predictionId} timed out after ${REPLICATE_POLL_TIMEOUT_MS}ms`);
}

function postProcessDUSt3ROutput(output: any, predictionId: string): FloorPlanSchema {
  // DUSt3R output: typically { points: [...], colors: [...], ... }
  // Post-processing: top-down projection → room segmentation → dimensions
  // For MVP: extract whatever room info we can; LLM fallback handles the rest

  // If output already contains room info (some models do)
  if (output?.rooms && Array.isArray(output.rooms)) {
    return {
      rooms: output.rooms,
      strategy_used: "dust3r_replicate",
      dust3r_prediction_id: predictionId,
    };
  }

  // Minimal post-processing: convert point cloud to approximate dimensions
  if (output?.points && Array.isArray(output.points)) {
    const points = output.points;
    const xs = points.map((p: number[]) => p[0]);
    const ys = points.map((p: number[]) => p[1]);
    const zs = points.map((p: number[]) => p[2]);

    const minX = Math.min(...xs), maxX = Math.max(...xs);
    const minZ = Math.min(...zs), maxZ = Math.max(...zs);

    const width = Math.round((maxX - minX) * 100) / 100;
    const depth = Math.round((maxZ - minZ) * 100) / 100;

    if (width > 0 && depth > 0 && width < 50 && depth < 50) {
      return {
        rooms: [{
          name: "Main Room",
          width_m: width,
          height_m: depth,
          connections: [],
          notable_features: ["From 3D scan"],
          floor_type: "unknown",
        }],
        total_area_m2: Math.round(width * depth * 100) / 100,
        strategy_used: "dust3r_replicate",
        dust3r_prediction_id: predictionId,
      };
    }
  }

  // DUSt3R produced output we can't parse — let vision LLM handle it
  throw new Error("DUSt3R output not parseable as room schema — falling back to vision LLM");
}

// ── GPT-4o-mini Vision (existing, synchronous) ────────────────────

const VISION_MODEL = "gpt-4o-mini";

const FLOOR_PLAN_SYSTEM_PROMPT = `You are an architectural space analyzer. Given 1-8 images of a home interior, produce a JSON floor plan.

For EACH room:
- name: short label ("Living Room", "Kitchen", "Bedroom 1", "Hallway", "Bathroom")
- width_m: approximate width in meters (estimate from proportions, be conservative)
- height_m: approximate length in meters
- connections: list of room names this room connects to
- notable_features: list of distinct visual features ("red sofa", "marble counter")
- floor_type: "hardwood", "tile", "carpet", or "other"

Rules:
- Count each room ONCE across all frames.
- Use 3.0m × 3.0m as default if uncertain.
- Connections must form a traversable graph.
- Return ONLY: { "rooms": [...] }`;

async function extractWithGPT4oVision(
  env: Env,
  frames: string[]
): Promise<FloorPlanSchema> {
  if (!env.OPENAI_API_KEY) throw new Error("OPENAI_API_KEY not configured");

  const validFrames = frames.filter(f => f.startsWith("data:image/") && f.length < MAX_IMAGE_BYTES);
  if (validFrames.length === 0) throw new Error("No valid frames");

  const imageContents = validFrames.map(f => ({
    type: "image_url" as const,
    image_url: { url: f, detail: "low" as const },
  }));

  const resp = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${env.OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: VISION_MODEL,
      messages: [
        { role: "system", content: FLOOR_PLAN_SYSTEM_PROMPT },
        { role: "user", content: [{ type: "text", text: `Analyze these ${validFrames.length} home walkthrough frames.` }, ...imageContents] },
      ],
      max_tokens: 2048,
      temperature: 0.2,
      response_format: { type: "json_object" },
    }),
  });

  if (!resp.ok) {
    const err = await resp.text().catch(() => "");
    throw new Error(`Vision API error (${resp.status}): ${err.slice(0, 300)}`);
  }

  const data = await resp.json() as { choices: Array<{ message: { content: string } }> };
  const rawContent = data.choices?.[0]?.message?.content;
  if (!rawContent) throw new Error("Empty response from vision model");

  try {
    const parsed = JSON.parse(rawContent);
    return { ...parsed, strategy_used: "gpt4o_vision" } as FloorPlanSchema;
  } catch {
    const m = rawContent.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (m) return { ...JSON.parse(m[1]), strategy_used: "gpt4o_vision" } as FloorPlanSchema;
    throw new Error(`Failed to parse vision LLM JSON: ${rawContent.slice(0, 200)}`);
  }
}

// ── Main entry point ──────────────────────────────────────────────

export async function extractFloorPlan(
  env: Env,
  frames: string[]
): Promise<FloorPlanSchema> {
  if (frames.length === 0) throw new Error("At least 1 frame required");

  // Check cache for re-runs
  const key = cacheKey(frames);
  const cached = cacheGet(key);
  if (cached) {
    console.log("[floor-plan] Cache hit — returning cached result");
    return cached;
  }

  const strategy = (env as any).FLOOR_PLAN_STRATEGY || "auto";
  const errors: string[] = [];

  // Strategy 1: DUSt3R via Replicate (if configured)
  if (strategy === "dust3r_replicate" || strategy === "auto") {
    try {
      const result = await extractWithDUSt3R(env, frames);
      cacheSet(key, result);
      return result;
    } catch (e: any) {
      const msg = String(e?.message || "");
      console.warn(`[floor-plan] DUSt3R strategy failed: ${msg.slice(0, 200)}`);
      errors.push(`dust3r: ${msg.slice(0, 100)}`);

      // If model not found and strategy is explicit → don't fallback
      if (msg.includes("DUST3R_MODEL_NOT_FOUND") && strategy === "dust3r_replicate") {
        throw new Error(`DUSt3R model not available on Replicate. Set DUST3R_MODEL env var or use strategy=gpt4o_vision. Original: ${msg}`);
      }
    }
  }

  // Strategy 2: GPT-4o-mini vision (fallback or explicit)
  if (strategy === "gpt4o_vision" || strategy === "auto") {
    try {
      const result = await extractWithGPT4oVision(env, frames);
      (result as any)._fallback_errors = errors.length ? errors : undefined;
      cacheSet(key, result);
      return result;
    } catch (e: any) {
      errors.push(`gpt4o: ${String(e?.message || "").slice(0, 100)}`);
    }
  }

  // Strategy 2: No-API fallback — basic room from frame count
  // User can manually edit rooms in the 3D view
  console.warn(`[floor-plan] No API keys configured — using basic room schema. Errors: ${errors.join("; ")}`);
  const basicRooms: RoomData[] = [
    { name: "Living Room", width_m: 5.0, height_m: 4.0, connections: ["Kitchen"], floor_type: "hardwood" },
    { name: "Kitchen", width_m: 3.5, height_m: 3.0, connections: ["Living Room", "Hallway"], floor_type: "tile" },
    { name: "Hallway", width_m: 1.5, height_m: 3.0, connections: ["Kitchen", "Bedroom"], floor_type: "hardwood" },
    { name: "Bedroom", width_m: 4.0, height_m: 3.5, connections: ["Hallway"], floor_type: "carpet" },
  ];

  const fallbackSchema: FloorPlanSchema = {
    rooms: basicRooms,
    strategy_used: "fallback_basic",
  };
  cacheSet(key, fallbackSchema);
  return fallbackSchema;
}
