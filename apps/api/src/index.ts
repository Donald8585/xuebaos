import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { createDb, type Database } from "./db/index";

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
import technocraticRoutes from "./routes/technocratic";
import clerkWebhookRoutes from "./routes/clerk-webhook";

// ── Services ────────────────────────────────────────────────────
import { createStorageService } from "./services/storage";

// ── Environment Bindings ────────────────────────────────────────
export interface Env {
  DB: D1Database;
  STORAGE: R2Bucket;
  CACHE: KVNamespace;
  AI_QUEUE: Queue;
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

// CORS
app.use("*", async (c, next) => {
  const origin = c.env.CORS_ORIGIN || "https://xuebaos.com";
  const corsMiddleware = cors({
    origin: (o) => {
      if (
        o.endsWith(".xuebaos.com") ||
        o === "https://xuebaos.com" ||
        o.startsWith("http://localhost:") ||
        o.startsWith("http://127.0.0.1:")
      ) {
        return o;
      }
      return origin;
    },
    allowMethods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    allowHeaders: ["Content-Type", "Authorization", "X-Requested-With"],
    exposeHeaders: ["X-RateLimit-Limit", "X-RateLimit-Remaining", "X-RateLimit-Reset"],
    maxAge: 86400,
    credentials: true,
  });
  return corsMiddleware(c, next);
});

// Logger
app.use("*", logger());

// ════════════════════════════════════════════════════════════════
// Database Middleware — Inject Drizzle DB on every request
// ════════════════════════════════════════════════════════════════
app.use("*", async (c, next) => {
  const db = createDb(c.env.DB);
  (c as any).set("db", db);
  await next();
});

// ════════════════════════════════════════════════════════════════
// Health Check
// ════════════════════════════════════════════════════════════════
app.get("/api/health", async (c) => {
  return c.json({
    status: "ok",
    app: c.env.APP_NAME || "XueBaOS",
    environment: c.env.ENVIRONMENT || "unknown",
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
app.route("/api/qbank", qbankRoutes);
app.route("/api/ai", aiRoutes);
app.route("/api/payments", paymentRoutes);
app.route("/api/analytics", analyticsRoutes);
app.route("/api/annotations", annotationRoutes);
app.route("/api/reading-vault", readingVaultRoutes);
app.route("/api/recall-arena", recallArenaRoutes);
app.route("/api/technocratic", technocraticRoutes);
app.route("/api/clerk", clerkWebhookRoutes);

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
  console.error(`Unhandled error: ${err.message}`, err.stack);

  const env = c.env?.ENVIRONMENT;
  const isDev = env === "development" || env === "staging";

  return c.json(
    {
      error: "Internal server error",
      ...(isDev && { details: err.message, stack: err.stack }),
    },
    500
  );
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
    return app.fetch(request, env, ctx);
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
  const db = createDb(env.DB);

  switch (job.type) {
    case "generate-palace": {
      const { topic, concepts } = job.payload as { topic: string; concepts: string[] };
      const { deepseekChat } = await import("./services/ai");
      const result = await deepseekChat(env, [
        { role: "user", content: `Generate a memory palace for topic: ${topic}, concepts: ${concepts.join(", ")}` },
      ]);
      const jobId = job.payload.jobId as string;
      if (jobId) {
        await env.CACHE.put(`job:${jobId}`, JSON.stringify({ status: "completed", result: JSON.parse(result) }), {
          expirationTtl: 3600,
        });
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
