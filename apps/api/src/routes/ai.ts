import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { eq } from "drizzle-orm";
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


// ════════════════════════════════════════════════════════════════
// POST /api/ai/generate-palace — Extract concepts, generate loci
// ════════════════════════════════════════════════════════════════
ai.post("/generate-palace", authMiddleware, zValidator("json", generatePalaceSchema), async (c) => {
  const requestId = crypto.randomUUID();
  const internalUserId = c.get("internalUserId");
  const contentLength = Number(c.req.header("content-length") || 0);
  console.log("[stage.ai.generate-palace]", JSON.stringify({ requestId, contentLength }));

  try {
    const body = c.req.valid("json");
    const totalChars = body.concepts.reduce((sum, c) => sum + c.length, 0);

    // Large payloads (>50KB) → async via queue to avoid Worker timeout
    if (contentLength > 50000 || totalChars > 50000) {
      const jobId = crypto.randomUUID();
      await c.env.AI_QUEUE.send({
        type: "generate-palace",
        userId: internalUserId,
        payload: { topic: body.topic, concepts: body.concepts, count: body.count, jobId },
      });
      // Store pending job in KV for polling
      await c.env.CACHE.put(`job:${jobId}`, JSON.stringify({ status: "queued", requestId }), { expirationTtl: 3600 });
      return c.json({ jobId, status: "queued", requestId }, 202);
    }

    // Small payloads → synchronous
    const result = await generatePalace(c.env, body.topic, body.concepts, body.count);
    return c.json({ ...result, requestId });
  } catch (err) {
    console.error("[ai.generate-palace.fail]", JSON.stringify({ requestId, msg: String(err).slice(0, 200) }));
    return c.json({ error: "ai_generation_failed", reason: "ai_error", stage: "handler", detail: String(err).slice(0, 200), requestId }, 502);
  }
});

// GET /api/ai/jobs/:jobId — Poll async job status
ai.get("/jobs/:jobId", authMiddleware, async (c) => {
  const jobId = c.req.param("jobId")!;
  try {
    const raw = await c.env.CACHE.get(`job:${jobId}`);
    if (!raw) return c.json({ status: "not_found" }, 404);
    return c.json(JSON.parse(raw));
  } catch {
    return c.json({ status: "error" }, 500);
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

// ════════════════════════════════════════════════════════════════
// M1.2: POST /api/ai/symbol/:palaceId/:locusIndex — Generate symbol
// ════════════════════════════════════════════════════════════════
const symbolSchema = z.object({
  prompt: z.string().min(1).max(500),
  style: z.enum(["minimalist", "chinese-ink", "cyberpunk", "photoreal"]).optional(),
});

ai.post("/symbol/:palaceId/:locusIndex", authMiddleware, requireFeature("imageGeneration"), zValidator("json", symbolSchema), async (c) => {
  const requestId = crypto.randomUUID();
  const internalUserId = c.get("internalUserId");
  const { palaceId, locusIndex } = c.req.param("locusIndex") as any;
  const { prompt, style } = c.req.valid("json");
  const db = c.get("db");

  console.log("[stage.symbol.generate]", JSON.stringify({ requestId, palaceId, locusIndex }));

  try {
    const palace = await db.query.memoryPalaces.findFirst({
      where: (p: any, { eq }: any) => eq(p.id, palaceId),
    });
    if (!palace) return c.json({ error: "not_found", reason: "palace_not_found", stage: "handler", requestId }, 404);

    const idx = Number(c.req.param("locusIndex"));
    if (isNaN(idx)) return c.json({ error: "save_failed", reason: "invalid_locus", stage: "handler", requestId }, 400);

    const jobId = crypto.randomUUID();
    const job = {
      id: jobId,
      userId: internalUserId,
      jobType: "symbol_gen",
      status: "queued",
      payload: { palaceId, locusIndex: idx, prompt, style: style || "minimalist" },
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    await db.insert(db.schema.aiJobs).values(job as any);

    // Update loci_symbols with pending status
    const currentSymbols = (palace.lociSymbols || {}) as Record<string, any>;
    currentSymbols[String(idx)] = { prompt, style: style || "minimalist", status: "generating", jobId };

    await db.update(db.schema.memoryPalaces as any)
      .set({ lociSymbols: currentSymbols, updatedAt: new Date() } as any)
      .where(eq(db.schema.memoryPalaces.id, palaceId) as any);

    return c.json({ jobId, status: "queued", requestId }, 202);
  } catch (e: any) {
    console.error("[symbol.generate.fail]", JSON.stringify({ requestId, msg: String(e?.message ?? "").slice(0, 200) }));
    return c.json({ error: "internal_error", reason: "db_error", stage: "handler", detail: String(e?.message ?? "").slice(0, 200), requestId }, 500);
  }
});

// M1.2: GET /api/ai/symbol/:palaceId/:locusIndex/status
ai.get("/symbol/:palaceId/:locusIndex/status", authMiddleware, async (c) => {
  const { palaceId } = c.req.param() as any;
  const locusIndex = Number(c.req.param("locusIndex"));
  const db = c.get("db");

  try {
    const palace = await db.query.memoryPalaces.findFirst({
      where: (p: any, { eq }: any) => eq(p.id, palaceId),
    });
    if (!palace) return c.json({ error: "not_found" }, 404);

    const symbols = (palace.lociSymbols || {}) as Record<string, any>;
    const symbol = symbols[String(locusIndex)];
    if (!symbol) return c.json({ status: "not_requested" });

    if (symbol.jobId) {
      const job = await db.query.aiJobs.findFirst({
        where: (j: any, { eq }: any) => eq(j.id, symbol.jobId),
      });
      if (job) {
        return c.json({
          status: job.status,
          imageKey: symbol.imageKey,
          imageUrl: symbol.imageKey ? `/api/storage/${symbol.imageKey}` : null,
          error: job.error,
        });
      }
    }

    return c.json({ status: symbol.status || "unknown", imageKey: symbol.imageKey });
  } catch (e: any) {
    return c.json({ error: "internal_error", detail: String(e?.message ?? "").slice(0, 200) }, 500);
  }
});

export default ai;
