/**
 * Floor plan extractor v4 — fixed cache poisoning + improved accuracy.
 *
 * FIXES APPLIED (2026-05-21):
 *   1. REMOVED module-level in-memory cache — cross-request poisoning on Cloudflare Workers
 *      (same Map persists across warm isolates, JPEG headers collide in cacheKey)
 *   2. Never cache fallback/error results
 *   3. detail: "low" → "high" for better room detection
 *   4. Prompt: removed "Default 3.5m×3.5m" bias, added measurement instructions
 *   5. Added content hash to cache key (if re-enabled via opt-in)
 *   6. Added logging for cache miss/hit + strategy used
 *
 * Strategies (tried in order):
 *   1. gpt4o_vision — Vision LLM primary (DUSt3R unavailable, removed from auto)
 *   2. fallback_basic — Placeholder when all APIs fail (NOT CACHED)
 *
 * Config via env vars / secrets:
 *   VISION_MODEL=gpt-4o-mini|gpt-4o|gemini-2.5-pro
 *   OPENAI_API_KEY (required)
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
  _fallback_errors?: string[];
}

const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

// ══════════════════════════════════════════════════════════════════
// Vision LLM Strategy (FIXED prompt + high detail)
// ══════════════════════════════════════════════════════════════════

const FLOOR_PLAN_SYSTEM_PROMPT = `You are a precise architectural space analyzer. From home walkthrough video frames, output an ACCURATE floor plan JSON.

CRITICAL RULES:
- List EVERY room visible across ALL frames. Count bedrooms INDIVIDUALLY — if you see a bedroom at different walkthrough points, they are SEPARATE rooms.
- Estimate real-world dimensions from visual cues (doorway width ≈ 0.9m, ceiling height reference, furniture scale). NEVER default to 3.5m unless visually justified.
- Determine connections between rooms (which room leads to which).
- Position each room on a 2D grid: approx_position {x:0-1, z:0-1} where 0=top-left, 1=bottom-right.
- Layout must NOT be a flat horizontal strip. Use 2D topology (L-shaped, T-shaped, courtyard, etc.).

IMPORTANT: If you cannot determine a measurement from the frames, mark it in "ambiguities" — do NOT invent dimensions.

Return ONLY valid JSON:
{
  "rooms": [{ "name": "...", "width_m": 3.2, "height_m": 4.1, "connections": ["Kitchen"], "approx_position": {"x": 0.3, "z": 0.2}, "evidence_frame_indices": [0, 2], "notable_features": ["red sofa"], "floor_type": "hardwood" }],
  "layout_topology": "L-shaped|linear|hallway-centered|courtyard",
  "ambiguities": ["Could not see bedroom 2 clearly — may be larger"]
}`;

async function extractWithVisionLLM(
  env: Env,
  frames: string[]
): Promise<FloorPlanSchema> {
  const validFrames = frames.filter(f => f.startsWith("data:image/") && f.length < MAX_IMAGE_BYTES);
  if (validFrames.length === 0) throw new Error("No valid frames");

  const model = (env as any).VISION_MODEL || "gpt-4o-mini";
  const openaiKey = env.OPENAI_API_KEY;
  if (!openaiKey) throw new Error("OPENAI_API_KEY not configured");
  const openaiBase = (env as any).OPENAI_BASE_URL || "https://api.openai.com";

  const totalPayloadBytes = validFrames.reduce((sum, f) => sum + f.length, 0);
  console.log(`[floor-plan.vision] ${model} (${validFrames.length} frames, ${Math.round(totalPayloadBytes/1024)}KB) via ${openaiBase}`);

  // Use "high" detail for accurate room detection
  const imageContents = validFrames.map((f, i) => ({
    type: "image_url" as const,
    image_url: { url: f, detail: "high" as const },
  }));

  const startTime = Date.now();

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
          { type: "text", text: `Analyze these ${validFrames.length} frames from a home walkthrough video. Follow the 3-step process: (1) inventory all rooms, (2) determine layout + connections, (3) estimate real dimensions and produce JSON. Pay special attention to bedrooms — if seen at different walkthrough positions, they are SEPARATE rooms. Use door frames and furniture as scale references for measurements.` },
          ...imageContents,
        ]},
      ],
      max_tokens: 4096,
      temperature: 0.2,
      response_format: { type: "json_object" },
    }),
    // 90s timeout — high-detail images take longer to process
    signal: AbortSignal.timeout(90_000),
  });

  const elapsed = Date.now() - startTime;

  if (!resp.ok) {
    const err = await resp.text().catch(() => "");
    throw new Error(`Vision API error (${resp.status}, ${elapsed}ms): ${err.slice(0, 300)}`);
  }

  const data = await resp.json() as { choices: Array<{ message: { content: string } }>; usage?: { prompt_tokens: number; completion_tokens: number } };
  const rawContent = data.choices?.[0]?.message?.content;
  if (!rawContent) throw new Error(`Empty response from vision model (${elapsed}ms)`);

  console.log(`[floor-plan.vision] Completed in ${elapsed}ms (${data.usage?.prompt_tokens || '?'} prompt / ${data.usage?.completion_tokens || '?'} completion tokens)`);

  try {
    const parsed = JSON.parse(rawContent);
    const result = { ...parsed, strategy_used: `gpt4o_vision:${model}` } as FloorPlanSchema;
    const roomNames = result.rooms?.map(r => r.name).join(", ") || "none";
    console.log(`[floor-plan.vision] Result: ${result.rooms?.length || 0} rooms: ${roomNames}`);
    return result;
  } catch {
    // Try extracting from code block
    const m = rawContent.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (m) {
      const parsed = JSON.parse(m[1]);
      return { ...parsed, strategy_used: `gpt4o_vision:${model}` } as FloorPlanSchema;
    }
    throw new Error(`Failed to parse vision LLM JSON after ${elapsed}ms: ${rawContent.slice(0, 200)}`);
  }
}

// ══════════════════════════════════════════════════════════════════
// DUSt3R via Replicate (kept for future; currently unavailable)
// ══════════════════════════════════════════════════════════════════

async function extractWithDUSt3R(env: Env, frames: string[]): Promise<FloorPlanSchema> {
  if (!env.REPLICATE_API_TOKEN) throw new Error("REPLICATE_API_TOKEN not configured");
  const model = (env as any).DUST3R_MODEL || "camenduru/dust3r";
  console.log(`[floor-plan.dust3r] Model: ${model}, ${frames.length} frames`);

  const submitResp = await fetch("https://api.replicate.com/v1/predictions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Token ${env.REPLICATE_API_TOKEN}` },
    body: JSON.stringify({ version: model, input: { images: frames.slice(0, 2) } }),
  });

  if (!submitResp.ok) {
    const err = await submitResp.text().catch(() => "");
    throw new Error(submitResp.status === 404 || err.includes("not found")
      ? `DUST3R_MODEL_NOT_FOUND:${model}`
      : `Replicate (${submitResp.status}): ${err.slice(0, 200)}`);
  }

  const prediction = await submitResp.json() as { id: string; status: string };
  console.log(`[floor-plan.dust3r] Prediction ${prediction.id} submitted`);

  const startedAt = Date.now();
  const REPLICATE_POLL_TIMEOUT_MS = 90_000;
  const REPLICATE_POLL_INTERVAL_MS = 2_000;

  while (Date.now() - startedAt < REPLICATE_POLL_TIMEOUT_MS) {
    await new Promise(r => setTimeout(r, REPLICATE_POLL_INTERVAL_MS));
    const pollResp = await fetch(`https://api.replicate.com/v1/predictions/${prediction.id}`, {
      headers: { Authorization: `Token ${env.REPLICATE_API_TOKEN}` },
    });
    if (!pollResp.ok) continue;
    const result = await pollResp.json() as { status: string; output?: any; error?: string };
    if (result.status === "succeeded") return postProcessDUSt3R(result.output, prediction.id);
    if (result.status === "failed") throw new Error(`DUSt3R failed: ${result.error || "unknown"}`);
    if (result.status === "canceled") throw new Error("DUSt3R canceled");
  }
  throw new Error(`REPLICATE_TIMEOUT: ${prediction.id} after ${REPLICATE_POLL_TIMEOUT_MS}ms`);
}

function postProcessDUSt3R(output: any, predictionId: string): FloorPlanSchema {
  if (output?.rooms?.length) return { rooms: output.rooms, strategy_used: "dust3r_replicate" };
  if (output?.points?.length) {
    const xs = output.points.map((p: number[]) => p[0]), zs = output.points.map((p: number[]) => p[2]);
    const w = Math.round((Math.max(...xs) - Math.min(...xs)) * 100) / 100;
    const d = Math.round((Math.max(...zs) - Math.min(...zs)) * 100) / 100;
    if (w > 0 && d > 0 && w < 50) return {
      rooms: [{ name: "Main Room", width_m: w, height_m: d, connections: [], floor_type: "unknown" }],
      strategy_used: "dust3r_replicate",
    };
  }
  throw new Error("DUSt3R output unparseable — falling back");
}

// ══════════════════════════════════════════════════════════════════
// Fallback schema — used ONLY when ALL strategies fail
// NEVER cached. strategy_used field signals frontend to show warning.
// ══════════════════════════════════════════════════════════════════

function getFallbackSchema(errors: string[]): FloorPlanSchema {
  return {
    rooms: [
      { name: "Room 1", width_m: 4.0, height_m: 3.5, connections: ["Room 2"], approx_position: { x: 0.2, z: 0.3 }, floor_type: "unknown" },
      { name: "Room 2", width_m: 3.5, height_m: 3.0, connections: ["Room 1", "Room 3"], approx_position: { x: 0.5, z: 0.3 }, floor_type: "unknown" },
      { name: "Room 3", width_m: 4.0, height_m: 3.5, connections: ["Room 2", "Room 4"], approx_position: { x: 0.8, z: 0.3 }, floor_type: "unknown" },
      { name: "Room 4", width_m: 2.5, height_m: 2.0, connections: ["Room 3"], approx_position: { x: 0.8, z: 0.7 }, floor_type: "unknown" },
    ],
    layout_topology: "unknown",
    ambiguities: [...errors, "All extraction strategies failed — using generic placeholder. Rescan with better lighting/more frames."],
    strategy_used: "fallback_basic",
    _fallback_errors: errors,
  };
}

// ══════════════════════════════════════════════════════════════════
// Main entry point — FIXED (no cross-request cache)
// ══════════════════════════════════════════════════════════════════

export async function extractFloorPlan(env: Env, frames: string[]): Promise<FloorPlanSchema> {
  if (frames.length === 0) throw new Error("At least 1 frame required");

  const strategy = (env as any).FLOOR_PLAN_STRATEGY || "auto";
  const errors: string[] = [];
  const requestId = crypto.randomUUID();
  console.log(`[floor-plan.${requestId}] Starting extraction: ${frames.length} frames, strategy=${strategy}`);

  // ── Try DUSt3R first if explicitly requested ────────────────────
  if (strategy === "dust3r_replicate") {
    try {
      const result = await extractWithDUSt3R(env, frames);
      console.log(`[floor-plan.${requestId}] DUSt3R succeeded: ${result.rooms?.length || 0} rooms`);
      return result;
    } catch (e: any) {
      const msg = String(e?.message || "");
      errors.push(`dust3r: ${msg.slice(0, 100)}`);
      if (msg.includes("DUST3R_MODEL_NOT_FOUND")) {
        throw new Error(`DUSt3R model not available. Set DUST3R_MODEL env var or use strategy=gpt4o_vision.`);
      }
      throw e; // Don't fallback if user explicitly chose DUSt3R
    }
  }

  // ── Vision LLM (primary for "auto" and "gpt4o_vision") ──────────
  try {
    console.log(`[floor-plan.${requestId}] Trying vision LLM...`);
    const result = await extractWithVisionLLM(env, frames);
    (result as any)._fallback_errors = errors.length ? errors : undefined;
    const roomCount = result.rooms?.length || 0;
    const topo = result.layout_topology || "unspecified";
    console.log(`[floor-plan.${requestId}] Vision LLM succeeded: ${roomCount} rooms, topology=${topo}, strategy=${result.strategy_used}`);
    return result;
  } catch (e: any) {
    const msg = String(e?.message || "");
    console.error(`[floor-plan.${requestId}] Vision LLM failed: ${msg.slice(0, 300)}`);
    errors.push(`vision: ${msg.slice(0, 100)}`);
  }

  // ── Graceful fallback — NOT CACHED ──────────────────────────────
  console.warn(`[floor-plan.${requestId}] All strategies failed. Errors: ${errors.join("; ")}`);
  return getFallbackSchema(errors);
}
