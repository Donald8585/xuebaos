import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { eq, desc, and, sql } from "drizzle-orm";
import type { Env } from "../index";
import { authMiddleware } from "../middleware/auth";
import { processAnnotation } from "../services/ai";

const annotations = new Hono<{ Bindings: Env; Variables: Record<string, any> }>();

const DEFAULT_PAGE_SIZE = 20;

const createAnnotationSchema = z.object({
  title: z.string().min(1).max(300),
  content: z.string().optional(),
  sourceUrl: z.string().url().optional(),
  subject: z.string().optional(),
  tags: z.array(z.string()).optional(),
});

const updateAnnotationSchema = createAnnotationSchema.partial();

const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(DEFAULT_PAGE_SIZE),
  subject: z.string().optional(),
  isComplete: z.coerce.boolean().optional(),
});

// ════════════════════════════════════════════════════════════════
// GET /api/annotations — List annotations
// ════════════════════════════════════════════════════════════════
annotations.get("/", authMiddleware, zValidator("query", paginationSchema), async (c) => {
  const internalUserId = c.get("internalUserId");
  const { page, limit, subject, isComplete } = c.req.valid("query");
  const db = c.get("db");
  const offset = (page - 1) * limit;

  const conditions = [eq(db.schema.annotations.userId, internalUserId)];
  if (subject) conditions.push(eq(db.schema.annotations.subject, subject));
  if (isComplete !== undefined) conditions.push(eq(db.schema.annotations.isComplete, isComplete));
  const where = and(...conditions);

  const [results, countResult] = await Promise.all([
    db.select().from(db.schema.annotations).where(where)
      .orderBy(desc(db.schema.annotations.updatedAt)).limit(limit).offset(offset),
    db.select({ count: sql<number>`count(*)` }).from(db.schema.annotations).where(where),
  ]);

  return c.json({
    data: results,
    pagination: { page, limit, total: countResult[0]?.count ?? 0,
      totalPages: Math.ceil((countResult[0]?.count ?? 0) / limit) },
  });
});

// ════════════════════════════════════════════════════════════════
// GET /api/annotations/:id — Get annotation
// ════════════════════════════════════════════════════════════════
annotations.get("/:id", authMiddleware, async (c) => {
  const id = c.req.param("id");
  const internalUserId = c.get("internalUserId");
  const db = c.get("db");
  const ann = await db.query.annotations.findFirst({ where: (a, { eq }) => eq(a.id, id) });
  if (!ann) return c.json({ error: "Not found" }, 404);
  if (ann.userId !== internalUserId) return c.json({ error: "Forbidden" }, 403);
  return c.json(ann);
});

// ════════════════════════════════════════════════════════════════
// POST /api/annotations — Create annotation
// ════════════════════════════════════════════════════════════════
annotations.post("/", authMiddleware, zValidator("json", createAnnotationSchema), async (c) => {
  const internalUserId = c.get("internalUserId");
  const body = c.req.valid("json");
  const db = c.get("db");
  const id = crypto.randomUUID();
  const now = new Date();

  await db.insert(db.schema.annotations).values({
    id, userId: internalUserId, title: body.title,
    content: body.content ?? null, sourceUrl: body.sourceUrl ?? null,
    subject: body.subject ?? null, tags: body.tags ?? [],
    currentPass: 1, isComplete: false,
    createdAt: now, updatedAt: now,
  });

  const created = await db.query.annotations.findFirst({ where: (a, { eq }) => eq(a.id, id) });
  return c.json(created, 201);
});

// ════════════════════════════════════════════════════════════════
// PUT /api/annotations/:id — Update annotation
// ════════════════════════════════════════════════════════════════
annotations.put("/:id", authMiddleware, zValidator("json", updateAnnotationSchema), async (c) => {
  const internalUserId = c.get("internalUserId");
  const id = c.req.param("id");
  const body = c.req.valid("json");
  const db = c.get("db");

  const existing = await db.query.annotations.findFirst({ where: (a, { eq }) => eq(a.id, id) });
  if (!existing) return c.json({ error: "Not found" }, 404);
  if (existing.userId !== internalUserId) return c.json({ error: "Forbidden" }, 403);

  const updates: Record<string, unknown> = { updatedAt: new Date() };
  for (const [k, v] of Object.entries(body)) {
    if (v !== undefined) (updates as any)[k] = v;
  }

  await db.update(db.schema.annotations).set(updates).where(eq(db.schema.annotations.id, id));
  const updated = await db.query.annotations.findFirst({ where: (a, { eq }) => eq(a.id, id) });
  return c.json(updated);
});

// ════════════════════════════════════════════════════════════════
// DELETE /api/annotations/:id — Delete annotation
// ════════════════════════════════════════════════════════════════
annotations.delete("/:id", authMiddleware, async (c) => {
  const internalUserId = c.get("internalUserId");
  const id = c.req.param("id");
  const db = c.get("db");
  const existing = await db.query.annotations.findFirst({ where: (a, { eq }) => eq(a.id, id) });
  if (!existing) return c.json({ error: "Not found" }, 404);
  if (existing.userId !== internalUserId) return c.json({ error: "Forbidden" }, 403);
  await db.delete(db.schema.annotations).where(eq(db.schema.annotations.id, id));
  return c.json({ success: true });
});

// ════════════════════════════════════════════════════════════════
// POST /api/annotations/:id/pass — Process next annotation pass
// ════════════════════════════════════════════════════════════════
annotations.post("/:id/pass", authMiddleware, async (c) => {
  const internalUserId = c.get("internalUserId");
  const id = c.req.param("id");
  const db = c.get("db");

  const ann = await db.query.annotations.findFirst({ where: (a, { eq }) => eq(a.id, id) });
  if (!ann) return c.json({ error: "Not found" }, 404);
  if (ann.userId !== internalUserId) return c.json({ error: "Forbidden" }, 403);
  if (ann.currentPass > 3) return c.json({ error: "All passes complete" }, 400);

  if (!ann.content) return c.json({ error: "No content to process" }, 400);

  try {
    // Build previous content from prior passes
    let previousContent = "";
    if (ann.currentPass === 2 && ann.pass1Summary) previousContent = ann.pass1Summary;
    if (ann.currentPass === 3 && ann.pass2Analysis) previousContent = ann.pass2Analysis;

    const result = await processAnnotation(c.env, ann.content, ann.currentPass, previousContent);

    const updates: Record<string, unknown> = { updatedAt: new Date() };
    if (result.summary) {
      if (ann.currentPass === 1) updates.pass1Summary = result.summary;
      else if (ann.currentPass === 2) updates.pass2Analysis = result.summary;
      else if (ann.currentPass === 3) updates.pass3Synthesis = result.summary;
    }
    if (result.keyTerms) updates.keyTerms = result.keyTerms;
    if (result.questions) updates.questions = result.questions;
    updates.currentPass = ann.currentPass + 1;
    if (ann.currentPass === 3) updates.isComplete = true;

    await db.update(db.schema.annotations).set(updates).where(eq(db.schema.annotations.id, id));

    const updated = await db.query.annotations.findFirst({ where: (a, { eq }) => eq(a.id, id) });
    return c.json(updated);
  } catch (err) {
    console.error("Annotation pass failed:", err);
    return c.json({ error: "AI processing failed", details: String(err) }, 500);
  }
});

export default annotations;
