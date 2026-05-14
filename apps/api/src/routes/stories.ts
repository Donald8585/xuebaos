import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { eq, desc, and, sql } from "drizzle-orm";
import type { Env } from "../index";
import { authMiddleware } from "../middleware/auth";
import { checkLimit } from "../middleware/tier-gate";

const stories = new Hono<{ Bindings: Env; Variables: Record<string, any> }>();

const DEFAULT_PAGE_SIZE = 20;

const createStorySchema = z.object({
  title: z.string().min(1).max(300),
  content: z.string().optional(),
  subject: z.string().optional(),
  palaceId: z.string().optional(),
  concepts: z.array(z.string()).optional(),
  narrativeStyle: z.string().optional(),
  imageUrls: z.array(z.string().url()).optional(),
  isPublic: z.boolean().optional(),
  tags: z.array(z.string()).optional(),
});

const updateStorySchema = createStorySchema.partial();

const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(DEFAULT_PAGE_SIZE),
  subject: z.string().optional(),
});

stories.get("/", authMiddleware, zValidator("query", paginationSchema), async (c) => {
  const internalUserId = c.get("internalUserId");
  const { page, limit, subject } = c.req.valid("query");
  const db = c.get("db");
  const offset = (page - 1) * limit;

  const conditions = [eq(db.schema.mnemonicStories.userId, internalUserId)];
  if (subject) conditions.push(eq(db.schema.mnemonicStories.subject, subject));
  const where = and(...conditions);

  const [results, countResult] = await Promise.all([
    db.select().from(db.schema.mnemonicStories).where(where)
      .orderBy(desc(db.schema.mnemonicStories.updatedAt))
      .limit(limit).offset(offset),
    db.select({ count: sql<number>`count(*)` }).from(db.schema.mnemonicStories).where(where),
  ]);

  return c.json({
    data: results,
    pagination: { page, limit, total: countResult[0]?.count ?? 0,
      totalPages: Math.ceil((countResult[0]?.count ?? 0) / limit) },
  });
});

stories.get("/public", zValidator("query", paginationSchema), async (c) => {
  const { page, limit, subject } = c.req.valid("query");
  const db = c.get("db");
  const offset = (page - 1) * limit;

  const conditions = [eq(db.schema.mnemonicStories.isPublic, true)];
  if (subject) conditions.push(eq(db.schema.mnemonicStories.subject, subject));
  const where = and(...conditions);

  const [results, countResult] = await Promise.all([
    db.select().from(db.schema.mnemonicStories).where(where)
      .orderBy(desc(db.schema.mnemonicStories.updatedAt))
      .limit(limit).offset(offset),
    db.select({ count: sql<number>`count(*)` }).from(db.schema.mnemonicStories).where(where),
  ]);

  return c.json({
    data: results,
    pagination: { page, limit, total: countResult[0]?.count ?? 0,
      totalPages: Math.ceil((countResult[0]?.count ?? 0) / limit) },
  });
});

stories.get("/:id", async (c) => {
  const id = c.req.param("id");
  const db = c.get("db");
  const story = await db.query.mnemonicStories.findFirst({ where: (s, { eq }) => eq(s.id, id) });
  if (!story) return c.json({ error: "Not found" }, 404);
  const internalUserId = c.get("internalUserId");
  if (!story.isPublic && story.userId !== internalUserId) return c.json({ error: "Forbidden" }, 403);
  return c.json(story);
});

stories.post("/", authMiddleware, checkLimit("stories"), zValidator("json", createStorySchema), async (c) => {
  const internalUserId = c.get("internalUserId");
  const body = c.req.valid("json");
  const db = c.get("db");
  const id = crypto.randomUUID();
  const now = new Date();

  await db.insert(db.schema.mnemonicStories).values({
    id, userId: internalUserId, title: body.title,
    content: body.content ?? null, subject: body.subject ?? null,
    palaceId: body.palaceId ?? null, concepts: body.concepts ?? [],
    narrativeStyle: body.narrativeStyle ?? "default",
    imageUrls: body.imageUrls ?? [], isPublic: body.isPublic ?? false,
    tags: body.tags ?? [], createdAt: now, updatedAt: now,
  });

  const created = await db.query.mnemonicStories.findFirst({ where: (s, { eq }) => eq(s.id, id) });
  return c.json(created, 201);
});

stories.put("/:id", authMiddleware, zValidator("json", updateStorySchema), async (c) => {
  const internalUserId = c.get("internalUserId");
  const id = c.req.param("id");
  const body = c.req.valid("json");
  const db = c.get("db");

  const existing = await db.query.mnemonicStories.findFirst({ where: (s, { eq }) => eq(s.id, id) });
  if (!existing) return c.json({ error: "Not found" }, 404);
  if (existing.userId !== internalUserId) return c.json({ error: "Forbidden" }, 403);

  const updates: Record<string, unknown> = { updatedAt: new Date() };
  for (const [k, v] of Object.entries(body)) {
    if (v !== undefined) (updates as any)[k] = v;
  }

  await db.update(db.schema.mnemonicStories).set(updates).where(eq(db.schema.mnemonicStories.id, id));
  const updated = await db.query.mnemonicStories.findFirst({ where: (s, { eq }) => eq(s.id, id) });
  return c.json(updated);
});

stories.delete("/:id", authMiddleware, async (c) => {
  const internalUserId = c.get("internalUserId");
  const id = c.req.param("id");
  const db = c.get("db");
  const existing = await db.query.mnemonicStories.findFirst({ where: (s, { eq }) => eq(s.id, id) });
  if (!existing) return c.json({ error: "Not found" }, 404);
  if (existing.userId !== internalUserId) return c.json({ error: "Forbidden" }, 403);
  await db.delete(db.schema.mnemonicStories).where(eq(db.schema.mnemonicStories.id, id));
  return c.json({ success: true });
});

export default stories;
