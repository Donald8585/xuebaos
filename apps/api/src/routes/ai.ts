import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import type { Env } from "../index";
import { authMiddleware } from "../middleware/auth";
import { requireFeature } from "../middleware/tier-gate";
import {
  generatePalace,
  generateStory,
  generateSymbols,
  generateImage,
  gradeRecall,
  optimizeTimetable,
  feynmanGrade,
  generateConceptChain,
  analyzePassage,
  xuebaChat,
  xuebaChatStream,
} from "../services/ai";
import { createStorageService } from "../services/storage";

const ai = new Hono<{ Bindings: Env; Variables: Record<string, any> }>();

// ── Schemas ──────────────────────────────────────────────────────
const generatePalaceSchema = z.object({
  topic: z.string().min(1).max(300),
  concepts: z.array(z.string()).min(1).max(100),
  count: z.number().int().min(1).max(50).optional(),
});

const generateStorySchema = z.object({
  topic: z.string().min(1).max(300),
  concepts: z.array(z.string()).min(1).max(100),
  style: z.string().optional(),
});

const generateSymbolsSchema = z.object({
  topic: z.string().min(1).max(300),
  concepts: z.array(z.string()).min(1).max(100),
});

const generateImageSchema = z.object({
  prompt: z.string().min(1).max(1000),
  width: z.number().int().min(256).max(2048).optional(),
  height: z.number().int().min(256).max(2048).optional(),
  numOutputs: z.number().int().min(1).max(4).optional(),
});

const gradeRecallSchema = z.object({
  userRecall: z.string().min(1),
  correctContent: z.string().min(1),
});

const optimizeTimetableSchema = z.object({
  entries: z.array(z.object({
    day: z.string(),
    startTime: z.string(),
    endTime: z.string(),
    subject: z.string(),
    topic: z.string(),
  })),
  priorities: z.record(z.string(), z.number()),
});

const feynmanGradeSchema = z.object({
  topic: z.string().min(1),
  userExplanation: z.string().min(1),
});

const conceptChainSchema = z.object({
  topic: z.string().min(1).max(300),
  concepts: z.array(z.string()).min(2).max(50),
});

const analyzePassageSchema = z.object({
  passageText: z.string().min(1).max(50000),
  language: z.string().default("chinese"),
});

const transcribeSchema = z.object({
  language: z.string().default("zh"),
});

// ════════════════════════════════════════════════════════════════
// POST /api/ai/generate-palace — Extract concepts, generate loci
// ════════════════════════════════════════════════════════════════
ai.post("/generate-palace", authMiddleware, zValidator("json", generatePalaceSchema), async (c) => {
  try {
    const body = c.req.valid("json");
    const result = await generatePalace(c.env, body.topic, body.concepts, body.count);
    return c.json(result);
  } catch (err) {
    console.error("generate-palace failed:", err);
    return c.json({ error: "AI generation failed", details: String(err) }, 500);
  }
});

// ════════════════════════════════════════════════════════════════
// POST /api/ai/generate-story — Generate mnemonic narrative
// ════════════════════════════════════════════════════════════════
ai.post("/generate-story", authMiddleware, zValidator("json", generateStorySchema), async (c) => {
  try {
    const body = c.req.valid("json");
    const result = await generateStory(c.env, body.topic, body.concepts, body.style);
    return c.json(result);
  } catch (err) {
    console.error("generate-story failed:", err);
    return c.json({ error: "AI generation failed", details: String(err) }, 500);
  }
});

// ════════════════════════════════════════════════════════════════
// POST /api/ai/generate-symbols — Generate symbolic metaphors
// ════════════════════════════════════════════════════════════════
ai.post("/generate-symbols", authMiddleware, zValidator("json", generateSymbolsSchema), async (c) => {
  try {
    const body = c.req.valid("json");
    const result = await generateSymbols(c.env, body.topic, body.concepts);
    return c.json(result);
  } catch (err) {
    console.error("generate-symbols failed:", err);
    return c.json({ error: "AI generation failed", details: String(err) }, 500);
  }
});

// ════════════════════════════════════════════════════════════════
// POST /api/ai/generate-image — Replicate Flux image generation
// ════════════════════════════════════════════════════════════════
ai.post("/generate-image", authMiddleware, requireFeature("imageGeneration"), zValidator("json", generateImageSchema), async (c) => {
  try {
    const body = c.req.valid("json");
    const urls = await generateImage(c.env, body.prompt, {
      width: body.width,
      height: body.height,
      numOutputs: body.numOutputs,
    });

    // Upload generated images to R2 for permanent storage
    const storage = createStorageService(c.env);
    const storedUrls: string[] = [];

    for (let i = 0; i < urls.length; i++) {
      const url = urls[i];
      try {
        const resp = await fetch(url);
        if (resp.ok) {
          const key = `ai-images/${crypto.randomUUID()}.png`;
          await storage.upload(key, await resp.arrayBuffer(), "image/png");
          storedUrls.push(storage.getPublicUrl(key));
        } else {
          storedUrls.push(url); // Fallback to Replicate URL
        }
      } catch {
        storedUrls.push(url);
      }
    }

    return c.json({ urls: storedUrls });
  } catch (err) {
    console.error("generate-image failed:", err);
    return c.json({ error: "Image generation failed", details: String(err) }, 500);
  }
});

// ════════════════════════════════════════════════════════════════
// POST /api/ai/grade-recall — Grade recall using DeepSeek
// ════════════════════════════════════════════════════════════════
ai.post("/grade-recall", authMiddleware, zValidator("json", gradeRecallSchema), async (c) => {
  try {
    const body = c.req.valid("json");
    const result = await gradeRecall(c.env, body.userRecall, body.correctContent);
    return c.json(result);
  } catch (err) {
    console.error("grade-recall failed:", err);
    return c.json({ error: "Grading failed", details: String(err) }, 500);
  }
});

// ════════════════════════════════════════════════════════════════
// POST /api/ai/optimize-timetable — Graduated saturation algorithm
// ════════════════════════════════════════════════════════════════
ai.post("/optimize-timetable", authMiddleware, zValidator("json", optimizeTimetableSchema), async (c) => {
  try {
    const body = c.req.valid("json");
    const result = await optimizeTimetable(c.env, body.entries, body.priorities);
    return c.json(result);
  } catch (err) {
    console.error("optimize-timetable failed:", err);
    return c.json({ error: "Optimization failed", details: String(err) }, 500);
  }
});

// ════════════════════════════════════════════════════════════════
// POST /api/ai/feynman-grade — Grade Feynman teach-back
// ════════════════════════════════════════════════════════════════
ai.post("/feynman-grade", authMiddleware, zValidator("json", feynmanGradeSchema), async (c) => {
  try {
    const body = c.req.valid("json");
    const result = await feynmanGrade(c.env, body.topic, body.userExplanation);
    return c.json(result);
  } catch (err) {
    console.error("feynman-grade failed:", err);
    return c.json({ error: "Grading failed", details: String(err) }, 500);
  }
});

// ════════════════════════════════════════════════════════════════
// POST /api/ai/concept-chain — Generate concept story chain
// ════════════════════════════════════════════════════════════════
ai.post("/concept-chain", authMiddleware, zValidator("json", conceptChainSchema), async (c) => {
  try {
    const body = c.req.valid("json");
    const result = await generateConceptChain(c.env, body.topic, body.concepts);
    return c.json(result);
  } catch (err) {
    console.error("concept-chain failed:", err);
    return c.json({ error: "Generation failed", details: String(err) }, 500);
  }
});

// ════════════════════════════════════════════════════════════════
// POST /api/ai/analyze-passage — Analyze Chinese passage
// ════════════════════════════════════════════════════════════════
ai.post("/analyze-passage", authMiddleware, zValidator("json", analyzePassageSchema), async (c) => {
  try {
    const body = c.req.valid("json");
    const result = await analyzePassage(c.env, body.passageText, body.language);
    return c.json(result);
  } catch (err) {
    console.error("analyze-passage failed:", err);
    return c.json({ error: "Analysis failed", details: String(err) }, 500);
  }
});

// ════════════════════════════════════════════════════════════════
// POST /api/ai/chat — XueBaOS AI Chat with 學霸 Principles
// ════════════════════════════════════════════════════════════════

const chatSchema = z.object({
  messages: z.array(z.object({
    role: z.enum(["user", "assistant"]),
    content: z.string(),
  })),
});

ai.post("/chat", authMiddleware, requireFeature("aiChat"), zValidator("json", chatSchema), async (c) => {
  try {
    const body = c.req.valid("json");
    const reply = await xuebaChat(c.env, body.messages);
    return c.json({ reply });
  } catch (err) {
    console.error("Chat error:", err);
    return c.json({ error: "Chat failed", details: String(err) }, 500);
  }
});

// ════════════════════════════════════════════════════════════════
// POST /api/ai/chat/stream — Streaming chat via SSE
// ════════════════════════════════════════════════════════════════

ai.post("/chat/stream", authMiddleware, requireFeature("aiChat"), zValidator("json", chatSchema), async (c) => {
  try {
    const body = c.req.valid("json");
    const stream = await xuebaChatStream(c.env, body.messages);
    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  } catch (err) {
    console.error("Chat stream error:", err);
    return c.json({ error: "Chat stream failed", details: String(err) }, 500);
  }
});

// ════════════════════════════════════════════════════════════════
// POST /api/ai/transcribe — Whisper audio transcription
// ════════════════════════════════════════════════════════════════
ai.post("/transcribe", authMiddleware, requireFeature("audioNarration"), async (c) => {
  try {
    const formData = await c.req.formData();
    const audioFile = formData.get("file");
    const language = formData.get("language")?.toString() || "zh";

    if (!audioFile || !(audioFile instanceof File)) {
      return c.json({ error: "Audio file required" }, 400);
    }

    const arrayBuffer = await audioFile.arrayBuffer();

    // Construct form data for OpenAI Whisper
    const whisperForm = new FormData();
    whisperForm.append("file", new Blob([arrayBuffer], { type: audioFile.type }), audioFile.name || "audio.webm");
    whisperForm.append("model", "whisper-1");
    whisperForm.append("language", language);

    const resp = await fetch("https://api.openai.com/v1/audio/transcriptions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${c.env.OPENAI_API_KEY}`,
      },
      body: whisperForm,
    });

    if (!resp.ok) {
      const err = await resp.text();
      return c.json({ error: "Transcription failed", details: err }, 500);
    }

    const data = (await resp.json()) as { text: string };
    return c.json({ text: data.text });
  } catch (err) {
    console.error("transcribe failed:", err);
    return c.json({ error: "Transcription failed", details: String(err) }, 500);
  }
});

export default ai;
