import { Hono } from "hono";
import { logger } from "hono/logger";
import { createDb } from "./db/index";
import { MiddlewareError, validateTABLES } from "./lib/errors";

// Startup invariant — fails Worker init if TABLES registry is malformed
validateTABLES();

// ── Routes ──────────────────────────────────────────────────────
import authRoutes from "./routes/auth";
import palaceRoutes from "./routes/palaces";
import storyRoutes from "./routes/stories";
import symbolRoutes from "./routes/symbols";
import sessionRoutes from "./routes/sessions";
import timetableRoutes from "./routes/timetables";
import qbankRoutes from "./routes/qbank";
import aiRoutes from "./routes/ai";
import paymentRoutes from "./routes/payments";
import analyticsRoutes from "./routes/analytics";
import annotationRoutes from "./routes/annotations";
import readingVaultRoutes from "./routes/reading-vault";
import recallArenaRoutes from "./routes/recall-arena";
import walkthroughRoutes from "./routes/walkthroughs";
import reviewRoutes from "./routes/reviews";
import reviewCalendarRoutes from "./routes/review-calendar";
import abbreviationRoutes from "./routes/abbreviations";
import conceptChainRoutes from "./routes/concept-chains";
import exportRoutes from "./routes/exports";
import communityRoutes from "./routes/community";
import settingsRoutes from "./routes/settings";
import uploadRoutes from "./routes/uploads";
import technocraticRoutes from "./routes/technocratic";
import statsRoutes from "./routes/stats";
import clerkWebhookRoutes from "./routes/clerk-webhook";
import videoRoutes from "./routes/videos";
import anchorRoutes from "./routes/anchors";

// ── Services ────────────────────────────────────────────────────
import { createStorageService } from "./services/storage";

// ── Environment Bindings ────────────────────────────────────────
export interface Env {
  DB: D1Database;
  STORAGE: R2Bucket;
  IMAGES: R2Bucket;
  CACHE: KVNamespace;
  AI_QUEUE: Queue;
  AI: any; // Workers AI binding
  CLERK_SECRET_KEY: string;
  CLERK_WEBHOOK_SECRET: string;
  CLERK_JWKS_URL?: string;
  STRIPE_SECRET_KEY: string;
  STRIPE_WEBHOOK_SECRET: string;
  DEEPSEEK_API_KEY: string;
  REPLICATE_API_TOKEN: string;
  OPENAI_API_KEY: string;
  ELEVENLABS_API_KEY?: string;
  APP_NAME: string;
  ENVIRONMENT: string;
  CORS_ORIGIN: string;
}

// ── App ─────────────────────────────────────────────────────────
const app = new Hono<{ Bindings: Env }>();

// ════════════════════════════════════════════════════════════════
// Global Middleware
// ════════════════════════════════════════════════════════════════

// CORS — bulletproof: dedicated OPTIONS handler BEFORE any middleware
const ALLOWED_ORIGINS = ["https://xuebaos.com", "http://localhost:5173", "http://localhost:3000"];

function originAllowed(origin: string | null): string {
  if (!origin) return ALLOWED_ORIGINS[0];
  if (ALLOWED_ORIGINS.includes(origin)) return origin;
  if (origin.endsWith(".xuebaos.com")) return origin;
  if (origin.endsWith(".xuebaos.pages.dev")) return origin;
  return ALLOWED_ORIGINS[0];
}

function corsHeaders(origin: string | null): Record<string, string> {
  return {
    "Access-Control-Allow-Origin": originAllowed(origin),
    "Access-Control-Allow-Methods": "GET,POST,PUT,DELETE,PATCH,OPTIONS",
    "Access-Control-Allow-Headers": "authorization,content-type,x-web-version,x-request-id",
    "Access-Control-Allow-Credentials": "true",
    "Access-Control-Max-Age": "86400",
    "Access-Control-Expose-Headers": "x-request-id,x-worker-version",
    "Vary": "Origin",
  };
}

// Dedicated OPTIONS handler — runs BEFORE auth, logger, everything
app.options("*", (c) => {
  const origin = c.req.header("Origin");
  return new Response(null, { status: 204, headers: corsHeaders(origin || null) });
});

// CORS middleware for actual responses (non-OPTIONS)
app.use("*", async (c, next) => {
  await next();
  const origin = c.req.header("Origin");
  if (origin && c.res) {
    const h = corsHeaders(origin);
    for (const [k, v] of Object.entries(h)) {
      if (k !== "Access-Control-Allow-Methods" && k !== "Access-Control-Max-Age") {
        c.res.headers.set(k, v);
      }
    }
  }
});

// Logger
app.use("*", logger());

// Version header — confirms which deployment is live
const WORKER_VERSION = "f5a0b237-clean"; // bump on every deploy
app.use("*", async (c, next) => {
  await next();
  c.res.headers.set("X-Worker-Version", WORKER_VERSION);
});

// ════════════════════════════════════════════════════════════════
// Database Middleware — Inject Drizzle DB on every request
// ════════════════════════════════════════════════════════════════
app.use("*", async (c, next) => {
  try {
    if (!c.env?.DB) {
      const requestId = crypto.randomUUID();
      console.error("[db.middleware] DB binding undefined");
      return c.json({
        error: "internal_error",
        reason: "db_binding_missing",
        detail: "Database binding not configured",
        requestId,
      }, 500);
    }
    const db = createDb(c.env.DB);
    (c as any).set("db", db);
    await next();
  } catch (e: any) {
    const requestId = crypto.randomUUID();
    console.error("[db.middleware.fail]", JSON.stringify({
      requestId, msg: String(e?.message ?? "").slice(0, 200),
    }));
    return c.json({
      error: "internal_error",
      reason: "db_init_failed",
      detail: String(e?.message ?? "").slice(0, 200),
      requestId,
    }, 500);
  }
});

// ════════════════════════════════════════════════════════════════
// Health Check
// ════════════════════════════════════════════════════════════════
app.get("/api/health", async (c) => {
  return c.json({
    status: "ok",
    app: c.env.APP_NAME || "XueBaOS",
    environment: c.env.ENVIRONMENT || "unknown",
    version: WORKER_VERSION,
    builtAt: new Date().toISOString(),
    timestamp: new Date().toISOString(),
  });
});

// ════════════════════════════════════════════════════════════════
// Route Mounting
// ════════════════════════════════════════════════════════════════
app.route("/api/auth", authRoutes);
app.route("/api/palaces", palaceRoutes);
app.route("/api/stories", storyRoutes);
app.route("/api/symbols", symbolRoutes);
app.route("/api/sessions", sessionRoutes);
app.route("/api/timetables", timetableRoutes);
app.route("/api/timetable", timetableRoutes); // singular alias for frontend
app.route("/api/qbank", qbankRoutes);
app.route("/api/ai", aiRoutes);
app.route("/api/payments", paymentRoutes);
app.route("/api/analytics", analyticsRoutes);
app.route("/api/annotations", annotationRoutes);
app.route("/api/reading-vault", readingVaultRoutes);
app.route("/api/recall-arena", recallArenaRoutes);
app.route("/api/walkthroughs", walkthroughRoutes);
app.route("/api/reviews", reviewRoutes);
app.route("/api/reviews/calendar", reviewCalendarRoutes);
app.route("/api/abbreviations", abbreviationRoutes);
app.route("/api/concept-chains", conceptChainRoutes);
app.route("/api/exports", exportRoutes);
app.route("/api/community", communityRoutes);
// Note: public /p/:slug is at /api/community/p/:slug
app.route("/api/settings", settingsRoutes);
app.route("/api/uploads", uploadRoutes);
app.route("/api", uploadRoutes);  // _beacon at /api/_beacon
app.route("/debug", uploadRoutes); // /debug/cors
app.route("/api/technocratic", technocraticRoutes);
app.route("/api/stats", statsRoutes);
app.route("/api/clerk", clerkWebhookRoutes);
app.route("/api/videos", videoRoutes);
app.route("/api/anchors", anchorRoutes);

// ════════════════════════════════════════════════════════════════
// Storage Routes (proxied R2)
// ════════════════════════════════════════════════════════════════
app.get("/api/storage/:key{(.+)}", async (c) => {
  const key = c.req.param("key");
  const storage = createStorageService(c.env);
  const object = await storage.download(key);

  if (!object) {
    return c.json({ error: "File not found" }, 404);
  }

  const headers = new Headers();
  if (object.httpMetadata?.contentType) {
    headers.set("Content-Type", object.httpMetadata.contentType);
  }
  headers.set("Cache-Control", "public, max-age=31536000, immutable");

  return new Response(object.body, { headers });
});

app.put("/api/storage/upload/:key{(.+)}", async (c) => {
  const key = c.req.param("key");
  const contentType = c.req.query("contentType") || "application/octet-stream";
  const storage = createStorageService(c.env);

  const body = await c.req.arrayBuffer();
  await storage.upload(key, body, contentType);

  return c.json({ key, url: storage.getPublicUrl(key) }, 201);
});

// ════════════════════════════════════════════════════════════════
// Error Handler (must be before export default)
// ════════════════════════════════════════════════════════════════
app.onError((err, c) => {
  const requestId = crypto.randomUUID();
  const msg = String((err as any)?.message ?? err ?? "Unknown error");
  const stack = (err as any)?.stack?.split("\n").slice(0, 6) ?? [];

  // If a MiddlewareError, use its explicit tagging
  const isMiddleware = err instanceof MiddlewareError;
  const stage = isMiddleware ? "middleware" : "unknown";

  const reason = isMiddleware
    ? `middleware:${(err as MiddlewareError).middlewareName}`
    : /no such column/i.test(msg) ? "schema_drift"
    : /exceeded.*CPU|CPU.*time/i.test(msg) ? "cpu_exceeded"
    : /Cannot read properties|undefined is not|TypeError/i.test(msg) ? "middleware_null_ref"
    : /SQLITE_/i.test(msg) ? "db_error"
    : /network|timeout|unreachable/i.test(msg) ? "db_unavailable"
    : "unknown";

  console.error("[global.error]", JSON.stringify({
    requestId,
    reason,
    stage,
    path: c.req.path,
    method: c.req.method,
    msg: msg.slice(0, 300),
    stack: stack.slice(0, 5),
  }));

  const env = c.env?.ENVIRONMENT;
  const isDev = env === "development" || env === "staging";

  return c.json({
    error: "internal_error",
    reason,
    stage,
    detail: isDev ? msg.slice(0, 500) : "An unexpected error occurred",
    requestId,
    ...(isDev && { stack: stack.slice(0, 5) }),
  }, 500);
});

// 404 handler
app.notFound((c) => {
  return c.json({ error: "Not found", path: c.req.path }, 404);
});

// ════════════════════════════════════════════════════════════════
// Queue Consumer — AI Background Jobs
// ════════════════════════════════════════════════════════════════
export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const requestId = crypto.randomUUID();
    const url = new URL(request.url);

    // Per-stage logging
    const stage = (tag: string) => console.log(`[stage.${tag}]`, JSON.stringify({
      requestId, method: request.method, path: url.pathname,
    }));

    try {
      // Inject requestId into env for downstream use
      stage("entry");
      return await app.fetch(request, env, ctx);
    } catch (e: any) {
      // This catches exceptions that escape app.onError —
      // Worker-level crashes, CPU exceeded, module import failures, etc.
      const isMiddleware = e instanceof MiddlewareError;
      const stage = isMiddleware ? "middleware" : "worker";
      const reason = isMiddleware
        ? `middleware:${(e as MiddlewareError).middlewareName}`
        : "unhandled_exception";

      console.error("[worker.unhandled]", JSON.stringify({
        requestId,
        url: request.url,
        method: request.method,
        reason,
        stage,
        name: e?.name,
        msg: String(e?.message ?? "").slice(0, 500),
        stack: e?.stack?.split("\n").slice(0, 8).join(" | "),
      }));
      return new Response(JSON.stringify({
        error: "internal_error",
        reason,
        stage,
        detail: String(e?.message ?? "unknown").slice(0, 200),
        requestId,
      }), {
        status: 500,
        headers: {
          "content-type": "application/json",
          "x-request-id": requestId,
          "x-worker-version": WORKER_VERSION,
          ...corsHeaders(null),
        },
      });
    }
  },

  async queue(batch: MessageBatch<unknown>, env: Env, ctx: ExecutionContext): Promise<void> {
    for (const msg of batch.messages) {
      try {
        const job = msg.body as {
          type: string;
          userId: string;
          payload: Record<string, unknown>;
        };
        console.log(`Processing AI job: ${job.type} for user ${job.userId}`);

        switch (job.type) {
          case "generate-palace":
          case "generate-story":
          case "generate-symbols":
          case "analyze-passage":
          case "generate-questions":
            await handleAsyncAIJob(env, job);
            break;
          default:
            console.warn(`Unknown job type: ${job.type}`);
        }
        msg.ack();
      } catch (err) {
        console.error("Queue processing error:", err);
        msg.ack();
      }
    }
  },
};

async function handleAsyncAIJob(
  env: Env,
  job: { type: string; userId: string; payload: Record<string, unknown> }
): Promise<void> {
  switch (job.type) {
    case "generate-palace": {
      const { topic, concepts, count } = job.payload as { topic: string; concepts: string[]; count?: number };
      const jobId = job.payload.jobId as string;
      try {
        const { generatePalace } = await import("./services/ai");
        const result = await generatePalace(env, topic, concepts, count);
        if (jobId) {
          await env.CACHE.put(`job:${jobId}`, JSON.stringify({ status: "completed", result }), { expirationTtl: 3600 });
        }
      } catch (e: any) {
        if (jobId) {
          await env.CACHE.put(`job:${jobId}`, JSON.stringify({ status: "failed", error: String(e?.message ?? "AI generation failed").slice(0, 500) }), { expirationTtl: 3600 });
        }
      }
      break;
    }
    case "generate-questions": {
      const { subject, topic, content, mode, difficulty, count } = job.payload as {
        subject: string; topic: string; content: string;
        mode: string; difficulty: string; count: number;
      };
      const { generateQuestions } = await import("./services/ai");
      const result = await generateQuestions(env, subject, topic, content, mode as any, difficulty, count);
      const jobId = job.payload.jobId as string;
      if (jobId) {
        await env.CACHE.put(`job:${jobId}`, JSON.stringify({ status: "completed", result }), {
          expirationTtl: 3600,
        });
      }
      break;
    }
  }
}
