import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { eq, desc, and, sql } from "drizzle-orm";
import type { Env } from "../index";
import { authMiddleware } from "../middleware/auth";

const symbols = new Hono<{ Bindings: Env; Variables: Record<string, any> }>();

const DEFAULT_PAGE_SIZE = 20;

const createSymbolSchema = z.object({
  concept: z.string().min(1),
  symbol: z.string().min(1),
  description: z.string().optional(),
  category: z.string().optional(),
  storyId: z.string().optional(),
  imageUrl: z.string().url().optional(),
});

const updateSymbolSchema = createSymbolSchema.partial();

const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(DEFAULT_PAGE_SIZE),
  category: z.string().optional(),
  storyId: z.string().optional(),
});

symbols.get("/", authMiddleware, zValidator("query", paginationSchema), async (c) => {
  const internalUserId = c.get("internalUserId");
  const { page, limit, category, storyId } = c.req.valid("query");
  const db = c.get("db");
  const offset = (page - 1) * limit;

  const conditions = [eq(db.schema.symbols.userId, internalUserId)];
  if (category) conditions.push(eq(db.schema.symbols.category, category));
  if (storyId) conditions.push(eq(db.schema.symbols.storyId, storyId));
  const where = and(...conditions);

  const [results, countResult] = await Promise.all([
    db.select().from(db.schema.symbols).where(where)
      .orderBy(desc(db.schema.symbols.updatedAt)).limit(limit).offset(offset),
    db.select({ count: sql<number>`count(*)` }).from(db.schema.symbols).where(where),
  ]);

  return c.json({
    data: results,
    pagination: { page, limit, total: countResult[0]?.count ?? 0,
      totalPages: Math.ceil((countResult[0]?.count ?? 0) / limit) },
  });
});

symbols.get("/:id", authMiddleware, async (c) => {
  const id = c.req.param("id");
  const internalUserId = c.get("internalUserId");
  const db = c.get("db");
  const symbol = await db.query.symbols.findFirst({ where: (s, { eq }) => eq(s.id, id) });
  if (!symbol) return c.json({ error: "Not found" }, 404);
  if (symbol.userId !== internalUserId) return c.json({ error: "Forbidden" }, 403);
  return c.json(symbol);
});

symbols.post("/", authMiddleware, zValidator("json", createSymbolSchema), async (c) => {
  const internalUserId = c.get("internalUserId");
  const body = c.req.valid("json");
  const db = c.get("db");
  const id = crypto.randomUUID();
  const now = new Date();

  await db.insert(db.schema.symbols).values({
    id, userId: internalUserId, concept: body.concept, symbol: body.symbol,
    description: body.description ?? null, category: body.category ?? null,
    storyId: body.storyId ?? null, imageUrl: body.imageUrl ?? null,
    createdAt: now, updatedAt: now,
  });

  const created = await db.query.symbols.findFirst({ where: (s, { eq }) => eq(s.id, id) });
  return c.json(created, 201);
});

symbols.put("/:id", authMiddleware, zValidator("json", updateSymbolSchema), async (c) => {
  const internalUserId = c.get("internalUserId");
  const id = c.req.param("id");
  const body = c.req.valid("json");
  const db = c.get("db");

  const existing = await db.query.symbols.findFirst({ where: (s, { eq }) => eq(s.id, id) });
  if (!existing) return c.json({ error: "Not found" }, 404);
  if (existing.userId !== internalUserId) return c.json({ error: "Forbidden" }, 403);

  const updates: Record<string, unknown> = { updatedAt: new Date() };
  for (const [k, v] of Object.entries(body)) {
    if (v !== undefined) (updates as any)[k] = v;
  }

  await db.update(db.schema.symbols).set(updates).where(eq(db.schema.symbols.id, id));
  const updated = await db.query.symbols.findFirst({ where: (s, { eq }) => eq(s.id, id) });
  return c.json(updated);
});

symbols.delete("/:id", authMiddleware, async (c) => {
  const internalUserId = c.get("internalUserId");
  const id = c.req.param("id");
  const db = c.get("db");
  const existing = await db.query.symbols.findFirst({ where: (s, { eq }) => eq(s.id, id) });
  if (!existing) return c.json({ error: "Not found" }, 404);
  if (existing.userId !== internalUserId) return c.json({ error: "Forbidden" }, 403);
  await db.delete(db.schema.symbols).where(eq(db.schema.symbols.id, id));
  return c.json({ success: true });
});

export default symbols;
