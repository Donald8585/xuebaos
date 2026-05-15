import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { eq, desc, and, sql } from "drizzle-orm";
import type { Env } from "../index";
import { authMiddleware } from "../middleware/auth";
import { checkLimit } from "../middleware/tier-gate";

const palaces = new Hono<{ Bindings: Env; Variables: Record<string, any> }>();

const DEFAULT_PAGE_SIZE = 20;
const MAX_BODY_BYTES = 1_000_000; // 1 MB

// ════════════════════════════════════════════════════════════════
// Error Classification — no more blanket 500
// ════════════════════════════════════════════════════════════════
type FailureReason =
  | "validation_failed"
  | "body_too_large"
  | "duplicate_slug"
  | "schema_drift"
  | "unique_violation"
  | "fk_violation"
  | "json_bind"
  | "ai_subcall_failed"
  | "cpu_exceeded"
  | "db_unavailable"
  | "unknown";

function classifyDbError(e: unknown): FailureReason {
  const msg = (e as any)?.message ?? "";
  const name = (e as any)?.name ?? "";
  const cause = (e as any)?.cause;
  const causeMsg = cause?.message ?? "";
  const code = cause?.code ?? (e as any)?.code ?? "";

  if (String(code).startsWith("SQLITE_")) {
    if (code === "SQLITE_CONSTRAINT_UNIQUE" || code === "SQLITE_CONSTRAINT") {
      if (/UNIQUE/i.test(causeMsg) || msg.includes("UNIQUE") || msg.includes("idx_palaces_user_slug"))
        return "unique_violation";
    }
    if (code === "SQLITE_CONSTRAINT_NOTNULL") {
      if (/NOT NULL/i.test(causeMsg) || msg.includes("NOT NULL")) return "fk_violation";
    }
    if (code === "SQLITE_ERROR") {
      if (/no such column/i.test(causeMsg) || /no such column/i.test(msg)) return "schema_drift";
      if (/unsupported type/i.test(causeMsg) || /unsupported type/i.test(msg)) return "json_bind";
    }
  }

  if (/column.*not found/i.test(msg) || /no such column/i.test(msg)) return "schema_drift";
  if (/unsupported type/i.test(msg) || /JSON/i.test(name)) return "json_bind";
  if (name === "ZodError") return "validation_failed";
  if (/exceeded.*CPU/i.test(msg) || /CPU.*time/i.test(msg)) return "cpu_exceeded";
  if (msg.includes("Exceeded CPU")) return "cpu_exceeded";
  if (/network/i.test(msg) || /timeout/i.test(msg) || /unreachable/i.test(msg)) return "db_unavailable";

  return "unknown";
}

function logFailure(ctx: string, userId: string | undefined, bodyBytes: number, e: unknown, requestId: string) {
  const err = e as any;
  const reason = classifyDbError(e);
  console.error(`[palaces.${ctx}.fail]`, JSON.stringify({
    userId,
    bodyBytes,
    requestId,
    reason,
    name: err?.name,
    msg: String(err?.message ?? "").slice(0, 200),
    sqliteCode: err?.cause?.code ?? err?.code,
    stack: err?.stack?.split("\n").slice(0, 5),
  }));
}

// ════════════════════════════════════════════════════════════════
// Helpers
// ════════════════════════════════════════════════════════════════

/** Generate a URL-safe slug from a name, truncating to 64 chars */
function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fff]+/g, "-") // preserve CJK, replace separators
    .replace(/^-+|-+$/g, "")
    .slice(0, 64)
    || "palace";
}

/** Strip base64 images from symbolicObjects, returning cleaned array + R2 upload map */
function stripBase64Images(
  objects: SymbolicObjectInput[] | undefined,
  palaceId: string
): { clean: SymbolicObjectInput[]; r2Uploads: Array<{ key: string; data: ArrayBuffer; mime: string }> } {
  const r2Uploads: Array<{ key: string; data: ArrayBuffer; mime: string }> = [];
  if (!objects?.length) return { clean: objects ?? [], r2Uploads };

  const clean = objects.map((obj, i) => {
    if (!obj.imageBase64) return obj;
    const { imageBase64, ...rest } = obj;
    // Extract mime and raw bytes from data URI
    const match = imageBase64.match(/^data:([^;]+);base64,(.+)$/);
    if (!match) {
      // Not a valid data URI — keep as-is (it's probably already a key/URL)
      return obj;
    }
    const [, mime, b64] = match;
    const binary = atob(b64);
    const bytes = new Uint8Array(binary.length);
    for (let j = 0; j < binary.length; j++) bytes[j] = binary.charCodeAt(j);

    const ext = mime.split("/")[1] || "png";
    const key = `palaces/${palaceId}/symbols/${i}.${ext}`;
    r2Uploads.push({ key, data: bytes.buffer, mime });

    return { ...rest, imageKey: key } as SymbolicObjectInput;
  });

  return { clean, r2Uploads };
}

// ── Zod Schemas ──────────────────────────────────────────────────

const symbolicObjectSchema = z.object({
  concept: z.string().min(1),
  symbol: z.string().min(1),
  description: z.string().optional(),
  imageBase64: z.string().optional(), // stripped before D1 write
  category: z.string().optional(),
});
type SymbolicObjectInput = z.infer<typeof symbolicObjectSchema>;

const spatialMapNodeSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  x: z.number(),
  y: z.number(),
  width: z.number().optional(),
  height: z.number().optional(),
  parentId: z.string().optional(),
  metadata: z.record(z.unknown()).optional(),
});

const abbreviationStepSchema = z.object({
  original: z.string().min(1),
  abbreviation: z.string().min(1),
  step: z.number().int(),
  rule: z.string().optional(),
});

const createPalaceSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().optional(),
  subject: z.string().optional(),
  lociCount: z.number().int().min(0).optional(),
  loci: z.array(z.object({
    concept: z.string(),
    description: z.string().optional(),
    mnemonic: z.string().optional(),
    position: z.number().optional(),
  })).optional(),
  // ── New AI-extracted fields ─────────────────────────────────
  spatialMap: z.array(spatialMapNodeSchema).optional(),
  symbolicObjects: z.array(symbolicObjectSchema).optional(),
  abbreviationChain: z.array(abbreviationStepSchema).optional(),
  // ── Shared ─────────────────────────────────────────────────
  imageUrl: z.string().url().optional(),
  isPublic: z.boolean().optional(),
  tags: z.array(z.string()).optional(),
});

const updatePalaceSchema = createPalaceSchema.partial();

const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(DEFAULT_PAGE_SIZE),
  subject: z.string().optional(),
  search: z.string().optional(),
});

// ════════════════════════════════════════════════════════════════
// GET /api/palaces — List user's palaces
// ════════════════════════════════════════════════════════════════
palaces.get("/", authMiddleware, zValidator("query", paginationSchema), async (c) => {
  const internalUserId = c.get("internalUserId");
  const { page, limit, subject, search } = c.req.valid("query");
  const db = c.get("db");
  const offset = (page - 1) * limit;

  const conditions = [eq(db.schema.memoryPalaces.userId, internalUserId)];
  if (subject) conditions.push(eq(db.schema.memoryPalaces.subject, subject));

  const where = and(...conditions);

  const [results, countResult] = await Promise.all([
    db
      .select()
      .from(db.schema.memoryPalaces)
      .where(where)
      .orderBy(desc(db.schema.memoryPalaces.updatedAt))
      .limit(limit)
      .offset(offset),
    db
      .select({ count: sql<number>`count(*)` })
      .from(db.schema.memoryPalaces)
      .where(where),
  ]);

  const total = countResult[0]?.count ?? 0;

  const palaces = results.map((p: any) => ({
    id: p.id,
    title: p.name,
    name: p.name,
    slug: p.slug,
    description: p.description || '',
    subject: p.subject || '',
    loci_count: p.lociCount || 0,
    lociCount: p.lociCount || 0,
    is_published: !!p.isPublic,
    isPublic: !!p.isPublic,
    tags: Array.isArray(p.tags) ? p.tags : [],
    extras: p.extras || {},
    created_at: p.createdAt ? new Date(p.createdAt).toISOString() : new Date().toISOString(),
    updated_at: p.updatedAt ? new Date(p.updatedAt).toISOString() : new Date().toISOString(),
    last_studied_at: null,
  }));

  return c.json({
    data: palaces,
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  });
});

// ════════════════════════════════════════════════════════════════
// GET /api/palaces/public — Public palaces
// ════════════════════════════════════════════════════════════════
palaces.get("/public", zValidator("query", paginationSchema), async (c) => {
  const { page, limit, subject, search } = c.req.valid("query");
  const db = c.get("db");
  const offset = (page - 1) * limit;

  const conditions = [eq(db.schema.memoryPalaces.isPublic, true)];
  if (subject) conditions.push(eq(db.schema.memoryPalaces.subject, subject));

  const where = and(...conditions);

  const [results, countResult] = await Promise.all([
    db
      .select()
      .from(db.schema.memoryPalaces)
      .where(where)
      .orderBy(desc(db.schema.memoryPalaces.updatedAt))
      .limit(limit)
      .offset(offset),
    db
      .select({ count: sql<number>`count(*)` })
      .from(db.schema.memoryPalaces)
      .where(where),
  ]);

  const total = countResult[0]?.count ?? 0;

  return c.json({
    data: results,
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  });
});

// ════════════════════════════════════════════════════════════════
// GET /api/palaces/:id — Get single palace
// ════════════════════════════════════════════════════════════════
palaces.get("/:id", async (c) => {
  const id = c.req.param("id");
  const db = c.get("db");

  const palace = await db.query.memoryPalaces.findFirst({
    where: (p, { eq }) => eq(p.id, id),
  });

  if (!palace) return c.json({ error: "Not found" }, 404);

  const internalUserId = c.get("internalUserId");
  if (!palace.isPublic && palace.userId !== internalUserId) {
    return c.json({ error: "Not authorized" }, 403);
  }

  return c.json({
    id: palace.id,
    name: palace.name,
    title: palace.name,
    slug: palace.slug,
    description: palace.description || '',
    subject: palace.subject || '',
    lociCount: palace.lociCount || 0,
    loci: palace.loci || [],
    extras: palace.extras || {},
    isPublic: !!palace.isPublic,
    tags: Array.isArray(palace.tags) ? palace.tags : [],
    created_at: palace.createdAt ? new Date(palace.createdAt).toISOString() : '',
  });
});

// ════════════════════════════════════════════════════════════════
// POST /api/palaces — Create palace (structured error handling)
// ════════════════════════════════════════════════════════════════
palaces.post("/", authMiddleware, checkLimit("palaces"), async (c) => {
  const requestId = crypto.randomUUID();
  const internalUserId = c.get("internalUserId");
  const db = c.get("db");
  const webVersion = c.req.header("x-web-version") || "unknown";
  let bodyBytes = 0;

  console.log("[stage.handler.enter]", JSON.stringify({
    requestId, userId: internalUserId, webVersion,
    contentLength: c.req.header("content-length"),
  }));

  // ── A.1 Body size guard (before any parsing) ──────────────────
  const contentLength = c.req.header("content-length");
  if (contentLength) {
    bodyBytes = Number(contentLength);
    if (bodyBytes > MAX_BODY_BYTES) {
      return c.json({
        error: "save_failed",
        reason: "body_too_large",
        stage: "handler",
        maxBytes: MAX_BODY_BYTES,
        actualBytes: bodyBytes,
        requestId,
      }, 413);
    }
  }

  // ── A.2 Parse & validate body ─────────────────────────────────
  let body: z.infer<typeof createPalaceSchema>;
  try {
    console.log("[stage.handler.parse]", JSON.stringify({ requestId }));
    const raw = await c.req.json();
    const parsed = createPalaceSchema.safeParse(raw);
    if (!parsed.success) {
      return c.json({
        error: "save_failed",
        reason: "validation_failed",
        stage: "handler",
        issues: parsed.error.issues.map(i => ({
          path: i.path.join("."),
          message: i.message,
          code: i.code,
        })),
        requestId,
      }, 400);
    }
    body = parsed.data;
  } catch (e: any) {
    bodyBytes = bodyBytes || 0;
    logFailure("create.parse", internalUserId, bodyBytes, e, requestId);
    return c.json({
      error: "save_failed",
      reason: "validation_failed",
      stage: "handler",
      detail: "Failed to parse request body as JSON",
      requestId,
    }, 400);
  }

  // ── B.1 Generate slug & content hash ──────────────────────────
  console.log("[stage.handler.slughash]", JSON.stringify({ requestId }));
  const slug = slugify(body.name);
  const payload = {
    name: body.name,
    description: body.description,
    subject: body.subject,
    loci: body.loci,
    spatialMap: body.spatialMap,
    symbolicObjects: body.symbolicObjects,
    abbreviationChain: body.abbreviationChain,
  };
  const contentHash = await hashPayload(payload);

  // ── B.2 Idempotency check — existing (userId, slug)? ──────────
  console.log("[stage.handler.idempotency]", JSON.stringify({ requestId, slug }));
  const existing = await db.query.memoryPalaces.findFirst({
    where: (p, { and, eq }) => and(
      eq(p.userId, internalUserId),
      eq(p.slug, slug),
    ),
  });

  if (existing) {
    if (existing.contentHash === contentHash) {
      // Same content — idempotent return
      console.log("[stage.handler.respond]", JSON.stringify({ requestId, outcome: "idempotent" }));
      return c.json({
        ...existing,
        __idempotent: true,
      }, 200);
    }
    // Different content, same slug — conflict
    return c.json({
      error: "save_failed",
      reason: "duplicate_slug",
      stage: "handler",
      detail: `A palace with slug "${slug}" already exists. Use a different name.`,
      existingId: existing.id,
      requestId,
    }, 409);
  }

  // ── B.3 Strip base64 images → R2 ──────────────────────────────
  const palaceId = crypto.randomUUID();
  let cleanedSymbolicObjects = body.symbolicObjects;
  const r2Uploads: Array<{ key: string; data: ArrayBuffer; mime: string }> = [];

  if (body.symbolicObjects?.length) {
    console.log("[stage.handler.r2]", JSON.stringify({ requestId, imageCount: body.symbolicObjects.filter(o => o.imageBase64).length }));
    const result = stripBase64Images(body.symbolicObjects, palaceId);
    cleanedSymbolicObjects = result.clean;
    r2Uploads.push(...result.r2Uploads);
  }

  // Upload stripped images to R2 (best-effort, non-blocking)
  for (const upload of r2Uploads) {
    try {
      await c.env.STORAGE.put(upload.key, upload.data, {
        httpMetadata: { contentType: upload.mime },
      });
    } catch (e) {
      console.error(`[palaces.create.r2] Failed to upload ${upload.key}:`, (e as any)?.message);
      // Continue — the imageKey is stored, upload can be retried
    }
  }

  // ── B.4 Build extras JSON ─────────────────────────────────────
  const extras: Record<string, unknown> = {};
  if (body.spatialMap?.length) extras.spatialMap = body.spatialMap;
  if (cleanedSymbolicObjects?.length) extras.symbolicObjects = cleanedSymbolicObjects;
  if (body.abbreviationChain?.length) extras.abbreviationChain = body.abbreviationChain;

  const now = new Date();
  const lociData = body.loci ?? [];

  // ── B.5 Single D1 INSERT ──────────────────────────────────────
  try {
    console.log("[stage.handler.insert]", JSON.stringify({ requestId }));
    await db.insert(db.schema.memoryPalaces).values({
      id: palaceId,
      userId: internalUserId,
      name: body.name,
      slug,
      contentHash,
      description: body.description ?? null,
      subject: body.subject ?? null,
      lociCount: lociData.length || body.lociCount || 0,
      loci: lociData,
      extras,
      imageUrl: body.imageUrl ?? null,
      isPublic: body.isPublic ?? false,
      tags: body.tags ?? [],
      createdAt: now,
      updatedAt: now,
    });
  } catch (e: any) {
    const reason = classifyDbError(e);
    logFailure("create.insert", internalUserId, bodyBytes, e, requestId);

    // Map D1 errors to user-facing responses
    const status = reason === "unique_violation" ? 409
      : reason === "fk_violation" ? 400
      : reason === "json_bind" ? 500
      : reason === "schema_drift" ? 500
      : reason === "db_unavailable" ? 500
      : 500;

    return c.json({
      error: "save_failed",
      reason,
      stage: "handler",
      detail: reason === "schema_drift"
        ? "Database schema mismatch — run migrations: drizzle/migrations/*.sql"
        : reason === "unique_violation"
          ? "A palace with this name already exists"
          : reason === "db_unavailable"
            ? "Database temporarily unavailable — retry later"
            : e?.message ?? "Database write failed",
      requestId,
    }, status);
  }

  // ── B.6 Fetch & return created record ─────────────────────────
  try {
    console.log("[stage.handler.fetchback]", JSON.stringify({ requestId }));
    const created = await db.query.memoryPalaces.findFirst({
      where: (p, { eq }) => eq(p.id, palaceId),
    });

    if (!created) {
      return c.json({
        error: "save_failed",
        reason: "unknown",
        stage: "handler",
        detail: "Record not found after successful insert",
        requestId,
      }, 500);
    }

    console.log("[stage.handler.respond]", JSON.stringify({ requestId, outcome: "created" }));
    return c.json(created, 201);
  } catch (e: any) {
    logFailure("create.fetchback", internalUserId, bodyBytes, e, requestId);
    // Insert succeeded even if fetch-back fails
    return c.json({
      id: palaceId,
      name: body.name,
      slug,
      status: "created",
    }, 201);
  }
});

// ════════════════════════════════════════════════════════════════
// PUT /api/palaces/:id — Update palace
// ════════════════════════════════════════════════════════════════
palaces.put("/:id", authMiddleware, zValidator("json", updatePalaceSchema), async (c) => {
  const internalUserId = c.get("internalUserId");
  const id = c.req.param("id");
  const body = c.req.valid("json");
  const db = c.get("db");

  const existing = await db.query.memoryPalaces.findFirst({
    where: (p, { eq }) => eq(p.id, id),
  });

  if (!existing) return c.json({ error: "Not found" }, 404);
  if (existing.userId !== internalUserId) return c.json({ error: "Forbidden" }, 403);

  const updates: Record<string, unknown> = { updatedAt: new Date() };
  if (body.name !== undefined) {
    updates.name = body.name;
    updates.slug = slugify(body.name);
  }
  if (body.description !== undefined) updates.description = body.description;
  if (body.subject !== undefined) updates.subject = body.subject;
  if (body.lociCount !== undefined) updates.lociCount = body.lociCount;
  if (body.loci !== undefined) updates.loci = body.loci;
  if (body.imageUrl !== undefined) updates.imageUrl = body.imageUrl;
  if (body.isPublic !== undefined) updates.isPublic = body.isPublic;
  if (body.tags !== undefined) updates.tags = body.tags;

  // Rebuild extras if AI fields are included
  if (body.spatialMap || body.symbolicObjects || body.abbreviationChain) {
    const extras: Record<string, unknown> = { ...(existing.extras || {}) };
    if (body.spatialMap !== undefined) extras.spatialMap = body.spatialMap;
    if (body.symbolicObjects !== undefined) extras.symbolicObjects = body.symbolicObjects;
    if (body.abbreviationChain !== undefined) extras.abbreviationChain = body.abbreviationChain;
    updates.extras = extras;
  }

  await db
    .update(db.schema.memoryPalaces)
    .set(updates)
    .where(eq(db.schema.memoryPalaces.id, id));

  const updated = await db.query.memoryPalaces.findFirst({
    where: (p, { eq }) => eq(p.id, id),
  });

  return c.json(updated);
});

// ════════════════════════════════════════════════════════════════
// DELETE /api/palaces/:id — Delete palace
// ════════════════════════════════════════════════════════════════
palaces.delete("/:id", authMiddleware, async (c) => {
  const internalUserId = c.get("internalUserId");
  const id = c.req.param("id");
  const db = c.get("db");

  const existing = await db.query.memoryPalaces.findFirst({
    where: (p, { eq }) => eq(p.id, id),
  });

  if (!existing) return c.json({ error: "Not found" }, 404);
  if (existing.userId !== internalUserId) return c.json({ error: "Forbidden" }, 403);

  await db.delete(db.schema.memoryPalaces).where(eq(db.schema.memoryPalaces.id, id));

  return c.json({ success: true });
});

// ════════════════════════════════════════════════════════════════
// Route-Level Error Handler — catches middleware failures before handler runs
// ════════════════════════════════════════════════════════════════
palaces.onError((err, c) => {
  const requestId = crypto.randomUUID();
  const msg = String((err as any)?.message ?? err ?? "Unknown error");
  const reason = classifyDbError(err);

  console.error("[palaces.route.fail]", JSON.stringify({
    requestId,
    reason,
    method: c.req.method,
    path: c.req.path,
    msg: msg.slice(0, 300),
    name: (err as any)?.name,
    stack: (err as any)?.stack?.split("\n").slice(0, 5),
  }));

  return c.json({
    error: "save_failed",
    reason,
    stage: "route",
    detail: msg.slice(0, 200),
    requestId,
  }, 500);
});

// ════════════════════════════════════════════════════════════════
// Utility
// ════════════════════════════════════════════════════════════════

/** Hash a JSON-serializable payload using SHA-256 (native Web Crypto) */
async function hashPayload(payload: unknown): Promise<string> {
  const json = JSON.stringify(payload);
  const data = new TextEncoder().encode(json);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hash))
    .map(b => b.toString(16).padStart(2, "0"))
    .join("");
}

export default palaces;
