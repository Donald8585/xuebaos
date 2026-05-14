import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { eq, desc, and, sql } from "drizzle-orm";
import type { Env } from "../index";
import { authMiddleware } from "../middleware/auth";
import { checkLimit } from "../middleware/tier-gate";

const palaces = new Hono<{ Bindings: Env; Variables: Record<string, any> }>();

const DEFAULT_PAGE_SIZE = 20;

// ── Schemas ──────────────────────────────────────────────────────
const createPalaceSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().optional(),
  subject: z.string().optional(),
  lociCount: z.number().int().min(0).optional(),
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

  // Transform to frontend-compatible format
  const palaces = results.map((p: any) => ({
    id: p.id,
    title: p.name,
    name: p.name,
    description: p.description || '',
    subject: p.subject || '',
    loci_count: p.lociCount || 0,
    lociCount: p.lociCount || 0,
    is_published: !!p.isPublic,
    isPublic: !!p.isPublic,
    tags: Array.isArray(p.tags) ? p.tags : [],
    created_at: p.createdAt ? new Date(p.createdAt).toISOString() : new Date().toISOString(),
    updated_at: p.updatedAt ? new Date(p.updatedAt).toISOString() : new Date().toISOString(),
    last_studied_at: null,
  }));

  return c.json({
    data: palaces,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
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
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
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

  if (!palace) {
    return c.json({ error: "Palace not found" }, 404);
  }

  // Allow access if public or if user owns it
  const internalUserId = c.get("internalUserId");
  if (!palace.isPublic && palace.userId !== internalUserId) {
    return c.json({ error: "Not authorized" }, 403);
  }

  return c.json(palace);
});

// ════════════════════════════════════════════════════════════════
// POST /api/palaces — Create palace
// ════════════════════════════════════════════════════════════════
palaces.post("/", authMiddleware, checkLimit("palaces"), zValidator("json", createPalaceSchema), async (c) => {
  const internalUserId = c.get("internalUserId");
  const body = c.req.valid("json");
  const db = c.get("db");
  const id = crypto.randomUUID();
  const now = new Date();

  await db.insert(db.schema.memoryPalaces).values({
    id,
    userId: internalUserId,
    name: body.name,
    description: body.description ?? null,
    subject: body.subject ?? null,
    lociCount: body.lociCount ?? 0,
    imageUrl: body.imageUrl ?? null,
    isPublic: body.isPublic ?? false,
    tags: body.tags ?? [],
    createdAt: now,
    updatedAt: now,
  });

  const created = await db.query.memoryPalaces.findFirst({
    where: (p, { eq }) => eq(p.id, id),
  });

  return c.json(created, 201);
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
  if (body.name !== undefined) updates.name = body.name;
  if (body.description !== undefined) updates.description = body.description;
  if (body.subject !== undefined) updates.subject = body.subject;
  if (body.lociCount !== undefined) updates.lociCount = body.lociCount;
  if (body.imageUrl !== undefined) updates.imageUrl = body.imageUrl;
  if (body.isPublic !== undefined) updates.isPublic = body.isPublic;
  if (body.tags !== undefined) updates.tags = body.tags;

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

export default palaces;
