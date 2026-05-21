/**
 * Floor plan extractor v3 — multi-strategy + upgraded prompt + model config.
 *
 * Strategies (tried in order):
 *   1. dust3r_replicate — DUSt3R via Replicate (webhook-ready, 90s timeout)
 *   2. gpt4o_vision      — Multi-step vision LLM (inventory→layout→JSON)
 *   3. fallback_basic     — Placeholder room schema when no APIs available
 *
 * Config via env vars / secrets:
 *   VISION_MODEL=gpt-4o-mini|gpt-4o|gemini-2.5-pro|claude-sonnet-4.5
 *   DUST3R_MODEL=owner/model:version
 *   FLOOR_PLAN_STRATEGY=auto|dust3r_replicate|gpt4o_vision
 *   OPENAI_BASE_URL=custom proxy URL (default: api.openai.com)
 */

import type { Env } from "../index";

interface RoomData {
  name: string;
  width_m: number;
  height_m: number;
  connections: string[];
  approx_position?: { x: number; z: number };
  evidence_frame_indices?: number[];
  notable_features?: string[];
  floor_type?: string;
}

interface FloorPlanSchema {
  rooms: RoomData[];
  total_area_m2?: number;
  floor_count?: number;
  layout_topology?: string;
  ambiguities?: string[];
  strategy_used?: string;
  dust3r_prediction_id?: string;
  _fallback_errors?: string[];
}

const MAX_FRAMES = 16;
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const REPLICATE_POLL_TIMEOUT_MS = 90_000;
const REPLICATE_POLL_INTERVAL_MS = 2_000;
const CACHE_TTL_MS = 3600_000;

const resultCache = new Map<string, { schema: FloorPlanSchema; ts: number }>();
function cacheKey(frames: string[]): string {
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

// ══════════════════════════════════════════════════════════════════
// Vision LLM Strategy (upgraded multi-step prompt)
// ══════════════════════════════════════════════════════════════════

const FLOOR_PLAN_SYSTEM_PROMPT = `You are an architectural space analyzer. From home walkthrough frames, output a floor plan JSON.

Steps:
1. List EVERY room across all frames. Count bedrooms: if seen at different walkthrough points → SEPARATE.
2. Determine connections + layout (linear/L-shaped/hallway-centered).
3. For each room: approx_position {x:0-1,z:0-1} in 2D (0=top-left, 1=bottom-right).

Return ONLY: { "rooms": [{ "name", "width_m", "height_m", "connections":[], "approx_position":{x,z}, "evidence_frame_indices":[], "notable_features":[], "floor_type" }], "layout_topology", "ambiguities":[] }

RULES: Default 3.5m×3.5m. No flat horizontal strips — use 2D. Connections must be traversable. Never merge rooms at different points.`;

async function extractWithVisionLLM(
  env: Env,
  frames: string[]
): Promise<FloorPlanSchema> {
  const validFrames = frames.filter(f => f.startsWith("data:image/") && f.length < MAX_IMAGE_BYTES);
  if (validFrames.length === 0) throw new Error("No valid frames");

  // ── Model selection (Gemini Flash via same proxy if configured) ──
  const modelPref = (env as any).VISION_MODEL || "gpt-4o-mini";
  const model = modelPref;  // "gpt-4o-mini" or "gemini-2.0-flash" — same proxy, same key
  const openaiKey = env.OPENAI_API_KEY;
  if (!openaiKey) throw new Error("OPENAI_API_KEY not configured");
  const openaiBase = (env as any).OPENAI_BASE_URL || "https://api.openai.com";

  console.log(`[floor-plan.vision] ${model} (${validFrames.length} frames via ${openaiBase})`);

  const imageContents = validFrames.map(f => ({
    type: "image_url" as const,
    image_url: { url: f, detail: "low" as const },
  }));

  const resp = await fetch(`${openaiBase}/v1/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${openaiKey}`,
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: "system", content: FLOOR_PLAN_SYSTEM_PROMPT },
        { role: "user", content: [
          { type: "text", text: `Analyze these ${validFrames.length} frames from a home walkthrough. Follow the 3-step process (inventory→layout→JSON). Pay special attention to bedrooms — if you see what looks like a bedroom at different points, they are SEPARATE rooms.` },
          ...imageContents,
        ]},
      ],
      max_tokens: 4096,
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
    return { ...parsed, strategy_used: `gpt4o_vision:${model}` } as FloorPlanSchema;
  } catch {
    const m = rawContent.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (m) return { ...JSON.parse(m[1]), strategy_used: `gpt4o_vision:${model}` } as FloorPlanSchema;
    throw new Error(`Failed to parse vision LLM JSON: ${rawContent.slice(0, 200)}`);
  }
}

// ══════════════════════════════════════════════════════════════════
// DUSt3R via Replicate (unchanged from v2)
// ══════════════════════════════════════════════════════════════════

const DUST3R_PROMPT = `Analyze this home interior point cloud/depth and produce a floor plan JSON:
{ "rooms": [{ "name": "Living Room", "width_m": 4.5, "height_m": 5.0, "connections": ["Kitchen", "Hallway"], "notable_features": ["red sofa", "TV unit"], "floor_type": "hardwood" }] }`;

interface ReplicatePrediction {
  id: string;
  status: "starting" | "processing" | "succeeded" | "failed" | "canceled";
  output?: any;
  error?: string;
}

async function extractWithDUSt3R(env: Env, frames: string[]): Promise<FloorPlanSchema> {
  if (!env.REPLICATE_API_TOKEN) throw new Error("REPLICATE_API_TOKEN not configured");
  const model = (env as any).DUST3R_MODEL || "camenduru/dust3r";
  console.log(`[floor-plan.dust3r] Model: ${model}, ${frames.length} frames`);

  const submitResp = await fetch("https://api.replicate.com/v1/predictions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Token ${env.REPLICATE_API_TOKEN}` },
    body: JSON.stringify({ version: model, input: { images: frames.slice(0, 2), prompt: DUST3R_PROMPT } }),
  });

  if (!submitResp.ok) {
    const err = await submitResp.text().catch(() => "");
    throw new Error(submitResp.status === 404 || err.includes("not found") ? `DUST3R_MODEL_NOT_FOUND:${model}` : `Replicate (${submitResp.status}): ${err.slice(0, 200)}`);
  }

  const prediction: ReplicatePrediction = await submitResp.json();
  console.log(`[floor-plan.dust3r] Prediction ${prediction.id} submitted`);
  const startedAt = Date.now();

  while (Date.now() - startedAt < REPLICATE_POLL_TIMEOUT_MS) {
    await new Promise(r => setTimeout(r, REPLICATE_POLL_INTERVAL_MS));
    const pollResp = await fetch(`https://api.replicate.com/v1/predictions/${prediction.id}`, {
      headers: { Authorization: `Token ${env.REPLICATE_API_TOKEN}` },
    });
    if (!pollResp.ok) continue;
    const result: ReplicatePrediction = await pollResp.json();
    if (result.status === "succeeded") return postProcessDUSt3R(result.output, prediction.id);
    if (result.status === "failed") throw new Error(`DUSt3R failed: ${result.error || "unknown"}`);
    if (result.status === "canceled") throw new Error("DUSt3R canceled");
  }
  throw new Error(`REPLICATE_TIMEOUT: ${prediction.id} after ${REPLICATE_POLL_TIMEOUT_MS}ms`);
}

function postProcessDUSt3R(output: any, predictionId: string): FloorPlanSchema {
  if (output?.rooms?.length) return { rooms: output.rooms, strategy_used: "dust3r_replicate", dust3r_prediction_id: predictionId };
  if (output?.points?.length) {
    const xs = output.points.map((p: number[]) => p[0]), zs = output.points.map((p: number[]) => p[2]);
    const w = Math.round((Math.max(...xs) - Math.min(...xs)) * 100) / 100;
    const d = Math.round((Math.max(...zs) - Math.min(...zs)) * 100) / 100;
    if (w > 0 && d > 0 && w < 50) return { rooms: [{ name: "Main Room", width_m: w, height_m: d, connections: [], floor_type: "unknown" }], strategy_used: "dust3r_replicate", dust3r_prediction_id: predictionId };
  }
  throw new Error("DUSt3R output unparseable — falling back");
}

// ══════════════════════════════════════════════════════════════════
// Main entry point
// ══════════════════════════════════════════════════════════════════

export async function extractFloorPlan(env: Env, frames: string[]): Promise<FloorPlanSchema> {
  if (frames.length === 0) throw new Error("At least 1 frame required");

  const key = cacheKey(frames);
  const cached = cacheGet(key);
  if (cached) { console.log("[floor-plan] Cache hit"); return cached; }

  const strategy = (env as any).FLOOR_PLAN_STRATEGY || "auto";
  const errors: string[] = [];

  if (strategy === "dust3r_replicate" || strategy === "auto") {
    try {
      const result = await extractWithDUSt3R(env, frames);
      cacheSet(key, result);
      return result;
    } catch (e: any) {
      const msg = String(e?.message || "");
      console.warn(`[floor-plan] DUSt3R failed: ${msg.slice(0, 200)}`);
      errors.push(`dust3r: ${msg.slice(0, 100)}`);
      if (msg.includes("DUST3R_MODEL_NOT_FOUND") && strategy === "dust3r_replicate") {
        throw new Error(`DUSt3R model not available. Set DUST3R_MODEL env var or use strategy=gpt4o_vision.`);
      }
    }
  }

  if (strategy === "gpt4o_vision" || strategy === "auto") {
    try {
      const result = await extractWithVisionLLM(env, frames);
      (result as any)._fallback_errors = errors.length ? errors : undefined;
      cacheSet(key, result);
      return result;
    } catch (e: any) {
      errors.push(`vision: ${String(e?.message || "").slice(0, 100)}`);
    }
  }

  // Graceful fallback
  console.warn(`[floor-plan] All strategies failed, using basic schema. Errors: ${errors.join("; ")}`);
  const fallback: FloorPlanSchema = {
    rooms: [
      { name: "Living Room", width_m: 5.0, height_m: 4.0, connections: ["Kitchen"], approx_position: { x: 0.4, z: 0.3 }, floor_type: "hardwood" },
      { name: "Kitchen", width_m: 3.5, height_m: 3.0, connections: ["Living Room", "Hallway"], approx_position: { x: 0.15, z: 0.2 }, floor_type: "tile" },
      { name: "Hallway", width_m: 1.5, height_m: 3.0, connections: ["Kitchen", "Bedroom 1", "Bathroom"], approx_position: { x: 0.6, z: 0.5 }, floor_type: "hardwood" },
      { name: "Bedroom 1", width_m: 4.0, height_m: 3.5, connections: ["Hallway"], approx_position: { x: 0.7, z: 0.8 }, floor_type: "carpet" },
      { name: "Bathroom", width_m: 2.0, height_m: 2.5, connections: ["Hallway"], approx_position: { x: 0.4, z: 0.7 }, floor_type: "tile" },
    ],
    layout_topology: "L-shaped",
    strategy_used: "fallback_basic",
  };
  cacheSet(key, fallback);
  return fallback;
}
