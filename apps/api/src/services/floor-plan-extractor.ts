/**
 * Floor plan extractor: client-uploaded walkthrough frames → LLM → room schema JSON.
 *
 * Uses OpenAI GPT-4o-mini (cheapest vision model) to detect rooms from frames.
 * Client is responsible for capturing frames from video via <video> + <canvas>
 * and sending them as base64 data URIs.
 */

import type { Env } from "../index";

interface RoomData {
  name: string;
  width_m: number;
  height_m: number;
  connections: string[];  // names of connected rooms
  notable_features?: string[];
  floor_type?: string;    // hardwood, tile, carpet, etc.
}

interface FloorPlanSchema {
  rooms: RoomData[];
  total_area_m2?: number;
  floor_count?: number;
}

const FLOOR_PLAN_SYSTEM_PROMPT = `You are an architectural space analyzer. Given 1-8 images of a home interior captured during a walkthrough video, produce a JSON floor plan.

For EACH room you identify:
- name: short label (e.g. "Living Room", "Kitchen", "Bedroom 1", "Hallway", "Bathroom")
- width_m: approximate width in meters (estimate from furniture/wall proportions, be conservative)
- height_m: approximate length in meters
- connections: list of room names this room connects to (doors, open archways)
- notable_features: list of distinct visual features (e.g. "red sofa", "marble counter", "bay window")
- floor_type: "hardwood", "tile", "carpet", or "other"

Rules:
- Count each room ONCE. Don't create duplicates for the same room seen from different angles.
- If you see a hallway/entryway, include it.
- If you can't determine dimensions, use 3.0m × 3.0m as default.
- Connections must form a traversable graph (you can walk from any room to any other).
- Order rooms from entrance → deepest.

Return ONLY valid JSON: { "rooms": [...] }`;

const VISION_MODEL = "gpt-4o-mini";
const MAX_FRAMES = 8;
const MAX_IMAGE_BYTES = 5 * 1024 * 1024; // 5MB per image

/**
 * Extract a floor plan schema from video frames using vision LLM.
 * @param frames - Array of base64 data URIs (data:image/jpeg;base64,...)
 */
export async function extractFloorPlan(
  env: Env,
  frames: string[]
): Promise<FloorPlanSchema> {
  if (!env.OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY not configured — vision models require OpenAI");
  }

  if (frames.length === 0) {
    throw new Error("At least 1 frame required for room detection");
  }

  // Limit frames + validate size
  const validFrames = frames
    .slice(0, MAX_FRAMES)
    .filter(f => f.startsWith("data:image/") && f.length < MAX_IMAGE_BYTES);

  if (validFrames.length === 0) {
    throw new Error("No valid frames provided (must be data:image/... base64 URIs under 5MB)");
  }

  // Build vision message content
  const imageContents = validFrames.map((frame, i) => ({
    type: "image_url" as const,
    image_url: { url: frame, detail: "low" as const },
  }));

  const messages = [
    {
      role: "system" as const,
      content: FLOOR_PLAN_SYSTEM_PROMPT,
    },
    {
      role: "user" as const,
      content: [
        { type: "text" as const, text: `Analyze these ${validFrames.length} frames from a home walkthrough video and return the floor plan as JSON.` },
        ...imageContents,
      ],
    },
  ];

  const resp = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${env.OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: VISION_MODEL,
      messages,
      max_tokens: 2048,
      temperature: 0.2,
      response_format: { type: "json_object" },
    }),
  });

  if (!resp.ok) {
    const err = await resp.text().catch(() => "");
    throw new Error(`OpenAI vision API error (${resp.status}): ${err.slice(0, 500)}`);
  }

  const data = (await resp.json()) as {
    choices: Array<{ message: { content: string } }>;
  };

  const rawContent = data.choices?.[0]?.message?.content;
  if (!rawContent) throw new Error("Empty response from vision model");

  try {
    const parsed = JSON.parse(rawContent);
    if (!parsed.rooms || !Array.isArray(parsed.rooms)) {
      throw new Error("Invalid floor plan: missing 'rooms' array");
    }
    return parsed as FloorPlanSchema;
  } catch (e: any) {
    console.error("[floor-plan-extractor] JSON parse failed", {
      rawContent: rawContent.slice(0, 500),
      error: String(e?.message ?? ""),
    });
    // Attempt to extract JSON from markdown code block
    const jsonMatch = rawContent.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[1]) as FloorPlanSchema;
    }
    throw new Error(`Failed to parse floor plan JSON: ${rawContent.slice(0, 200)}`);
  }
}
