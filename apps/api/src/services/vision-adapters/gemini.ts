/**
 * Gemini Vision adapter — Google Gemini 2.0 Flash for floor plan extraction.
 * Auto-detects GEMINI_API_KEY; falls back to GPT-4o-mini when unavailable.
 */

import type { Env } from "../../index";

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
  layout_topology?: string;
  ambiguities?: string[];
}

const GEMINI_MODEL = "gemini-2.0-flash";
const GEMINI_BASE = "https://generativelanguage.googleapis.com/v1beta";

/**
 * Call Gemini 2.0 Flash for vision-based room detection.
 * Gemini is 2-3x faster than GPT-4o-mini for vision tasks.
 */
export async function callGeminiVision(
  env: Env,
  systemPrompt: string,
  frames: string[],
  userText: string
): Promise<FloorPlanSchema> {
  if (!env.GEMINI_API_KEY) {
    throw new Error("GEMINI_API_KEY not configured");
  }

  const apiKey = env.GEMINI_API_KEY;
  const validFrames = frames.filter(f => f.startsWith("data:image/") && f.length < 5 * 1024 * 1024);
  if (validFrames.length === 0) throw new Error("No valid frames for Gemini");

  console.log(`[gemini-vision] Analyzing ${validFrames.length} frames with ${GEMINI_MODEL}`);

  // Build Gemini-format parts array: text + images
  const parts: any[] = [
    { text: `${systemPrompt}\n\n${userText}` },
  ];

  for (let i = 0; i < validFrames.length; i++) {
    const frame = validFrames[i];
    const b64 = frame.replace(/^data:image\/\w+;base64,/, "");
    parts.push({
      inlineData: { mimeType: "image/jpeg", data: b64 },
    });
  }

  const resp = await fetch(`${GEMINI_BASE}/models/${GEMINI_MODEL}:generateContent?key=${apiKey}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ parts }],
      generationConfig: {
        responseMimeType: "application/json",
        maxOutputTokens: 4096,
        temperature: 0.2,
      },
      safetySettings: [
        { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_ONLY_HIGH" },
      ],
    }),
  });

  if (!resp.ok) {
    const errText = await resp.text().catch(() => "");
    const isRateLimit = resp.status === 429;
    if (isRateLimit) throw new Error(`GEMINI_RATE_LIMITED: ${errText.slice(0, 200)}`);
    throw new Error(`Gemini API error (${resp.status}): ${errText.slice(0, 300)}`);
  }

  const data = await resp.json() as any;
  const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!rawText) throw new Error("Empty response from Gemini");

  try {
    const parsed = JSON.parse(rawText);
    if (parsed.rooms && Array.isArray(parsed.rooms)) return parsed as FloorPlanSchema;
    return { rooms: Array.isArray(parsed) ? parsed : [parsed] };
  } catch {
    const m = rawText.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (m) return JSON.parse(m[1]) as FloorPlanSchema;
    throw new Error(`Gemini returned non-JSON: ${rawText.slice(0, 200)}`);
  }
}
