import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { eq, desc, and, sql } from "drizzle-orm";
import type { Env } from "../index";
import { authMiddleware } from "../middleware/auth";
import { analyzePassage } from "../services/ai";
import type { VocabularyItem } from "../db/schema";

const readingVault = new Hono<{ Bindings: Env; Variables: Record<string, any> }>();

const DEFAULT_PAGE_SIZE = 20;

const createReadingSchema = z.object({
  title: z.string().min(1).max(300),
  originalText: z.string().min(1).max(100000),
  language: z.string().default("chinese"),
  difficultyLevel: z.number().int().min(1).max(10).optional(),
  sourceUrl: z.string().url().optional(),
  tags: z.array(z.string()).optional(),
});

const updateReadingSchema = createReadingSchema.partial();

const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(DEFAULT_PAGE_SIZE),
  language: z.string().optional(),
  difficultyLevel: z.coerce.number().int().min(1).max(10).optional(),
  isAnalyzed: z.coerce.boolean().optional(),
});

readingVault.get("/", authMiddleware, zValidator("query", paginationSchema), async (c) => {
  const internalUserId = c.get("internalUserId");
  const { page, limit, language, difficultyLevel, isAnalyzed } = c.req.valid("query");
  const db = c.get("db");
  const offset = (page - 1) * limit;

  const conditions = [eq(db.schema.readingVault.userId, internalUserId)];
  if (language) conditions.push(eq(db.schema.readingVault.language, language));
  if (difficultyLevel) conditions.push(eq(db.schema.readingVault.difficultyLevel, difficultyLevel));
  if (isAnalyzed !== undefined) conditions.push(eq(db.schema.readingVault.isAnalyzed, isAnalyzed));
  const where = and(...conditions);

  const [results, countResult] = await Promise.all([
    db.select().from(db.schema.readingVault).where(where)
      .orderBy(desc(db.schema.readingVault.updatedAt)).limit(limit).offset(offset),
    db.select({ count: sql<number>`count(*)` }).from(db.schema.readingVault).where(where),
  ]);

  return c.json({
    data: results,
    pagination: { page, limit, total: countResult[0]?.count ?? 0,
      totalPages: Math.ceil((countResult[0]?.count ?? 0) / limit) },
  });
});

readingVault.get("/:id", authMiddleware, async (c) => {
  const id = c.req.param("id");
  const internalUserId = c.get("internalUserId");
  const db = c.get("db");
  const reading = await db.query.readingVault.findFirst({ where: (r, { eq }) => eq(r.id, id) });
  if (!reading) return c.json({ error: "Not found" }, 404);
  if (reading.userId !== internalUserId) return c.json({ error: "Forbidden" }, 403);
  return c.json(reading);
});

readingVault.post("/", authMiddleware, zValidator("json", createReadingSchema), async (c) => {
  const internalUserId = c.get("internalUserId");
  const body = c.req.valid("json");
  const db = c.get("db");
  const id = crypto.randomUUID();
  const now = new Date();

  const wordCount = body.originalText.length;
  const readingTimeMinutes = Math.ceil(wordCount / 200); // ~200 chars/min for Chinese

  await db.insert(db.schema.readingVault).values({
    id, userId: internalUserId, title: body.title,
    originalText: body.originalText, language: body.language ?? "chinese",
    difficultyLevel: body.difficultyLevel ?? null,
    sourceUrl: body.sourceUrl ?? null, tags: body.tags ?? [],
    wordCount, readingTimeMinutes, isAnalyzed: false,
    createdAt: now, updatedAt: now,
  });

  const created = await db.query.readingVault.findFirst({ where: (r, { eq }) => eq(r.id, id) });
  return c.json(created, 201);
});

readingVault.put("/:id", authMiddleware, zValidator("json", updateReadingSchema), async (c) => {
  const internalUserId = c.get("internalUserId");
  const id = c.req.param("id");
  const body = c.req.valid("json");
  const db = c.get("db");

  const existing = await db.query.readingVault.findFirst({ where: (r, { eq }) => eq(r.id, id) });
  if (!existing) return c.json({ error: "Not found" }, 404);
  if (existing.userId !== internalUserId) return c.json({ error: "Forbidden" }, 403);

  const updates: Record<string, unknown> = { updatedAt: new Date() };
  for (const [k, v] of Object.entries(body)) {
    if (v !== undefined) (updates as any)[k] = v;
  }
  if (body.originalText) {
    updates.wordCount = body.originalText.length;
    updates.readingTimeMinutes = Math.ceil(body.originalText.length / 200);
  }

  await db.update(db.schema.readingVault).set(updates).where(eq(db.schema.readingVault.id, id));
  const updated = await db.query.readingVault.findFirst({ where: (r, { eq }) => eq(r.id, id) });
  return c.json(updated);
});

readingVault.delete("/:id", authMiddleware, async (c) => {
  const internalUserId = c.get("internalUserId");
  const id = c.req.param("id");
  const db = c.get("db");
  const existing = await db.query.readingVault.findFirst({ where: (r, { eq }) => eq(r.id, id) });
  if (!existing) return c.json({ error: "Not found" }, 404);
  if (existing.userId !== internalUserId) return c.json({ error: "Forbidden" }, 403);
  await db.delete(db.schema.readingVault).where(eq(db.schema.readingVault.id, id));
  return c.json({ success: true });
});

// ════════════════════════════════════════════════════════════════
// POST /api/reading-vault/:id/analyze — AI analysis
// ════════════════════════════════════════════════════════════════
readingVault.post("/:id/analyze", authMiddleware, async (c) => {
  const internalUserId = c.get("internalUserId");
  const id = c.req.param("id");
  const db = c.get("db");

  const reading = await db.query.readingVault.findFirst({ where: (r, { eq }) => eq(r.id, id) });
  if (!reading) return c.json({ error: "Not found" }, 404);
  if (reading.userId !== internalUserId) return c.json({ error: "Forbidden" }, 403);

  try {
    const result = await analyzePassage(c.env, reading.originalText, reading.language || "chinese");

    await db.update(db.schema.readingVault).set({
      difficultyLevel: result.difficultyLevel ?? 5,
      vocabulary: (result.vocabulary ?? []) as VocabularyItem[],
      grammarNotes: result.grammarNotes ?? null,
      translation: result.translation ?? null,
      analysis: result.analysis ?? null,
      isAnalyzed: true,
      updatedAt: new Date(),
    }).where(eq(db.schema.readingVault.id, id));

    const updated = await db.query.readingVault.findFirst({ where: (r, { eq }) => eq(r.id, id) });
    return c.json(updated);
  } catch (err) {
    console.error("Passage analysis failed:", err);
    return c.json({ error: "Analysis failed", details: String(err) }, 500);
  }
});

export default readingVault;
