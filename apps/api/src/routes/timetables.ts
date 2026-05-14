import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { eq, desc, and, sql } from "drizzle-orm";
import type { Env } from "../index";
import { authMiddleware } from "../middleware/auth";
import type { TimetableEntry } from "../db/schema";

const timetables = new Hono<{ Bindings: Env; Variables: Record<string, any> }>();

const DEFAULT_PAGE_SIZE = 20;

const entrySchema = z.object({
  day: z.string(),
  startTime: z.string(),
  endTime: z.string(),
  subject: z.string(),
  topic: z.string(),
  mode: z.string(),
});

const createTimetableSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().optional(),
  entries: z.array(entrySchema).default([]),
  isActive: z.boolean().default(true),
});

const updateTimetableSchema = createTimetableSchema.partial();

const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(DEFAULT_PAGE_SIZE),
});

timetables.get("/", authMiddleware, zValidator("query", paginationSchema), async (c) => {
  const internalUserId = c.get("internalUserId");
  const { page, limit } = c.req.valid("query");
  const db = c.get("db");
  const offset = (page - 1) * limit;

  const where = eq(db.schema.timetables.userId, internalUserId);

  const [results, countResult] = await Promise.all([
    db.select().from(db.schema.timetables).where(where)
      .orderBy(desc(db.schema.timetables.updatedAt)).limit(limit).offset(offset),
    db.select({ count: sql<number>`count(*)` }).from(db.schema.timetables).where(where),
  ]);

  return c.json({
    data: results,
    pagination: { page, limit, total: countResult[0]?.count ?? 0,
      totalPages: Math.ceil((countResult[0]?.count ?? 0) / limit) },
  });
});

timetables.get("/:id", authMiddleware, async (c) => {
  const id = c.req.param("id");
  const internalUserId = c.get("internalUserId");
  const db = c.get("db");
  const tt = await db.query.timetables.findFirst({ where: (t, { eq }) => eq(t.id, id) });
  if (!tt) return c.json({ error: "Not found" }, 404);
  if (tt.userId !== internalUserId) return c.json({ error: "Forbidden" }, 403);
  return c.json(tt);
});

timetables.post("/", authMiddleware, zValidator("json", createTimetableSchema), async (c) => {
  const internalUserId = c.get("internalUserId");
  const body = c.req.valid("json");
  const db = c.get("db");
  const id = crypto.randomUUID();
  const now = new Date();

  await db.insert(db.schema.timetables).values({
    id, userId: internalUserId, name: body.name,
    description: body.description ?? null,
    entries: body.entries as TimetableEntry[],
    isActive: body.isActive ?? true,
    createdAt: now, updatedAt: now,
  });

  const created = await db.query.timetables.findFirst({ where: (t, { eq }) => eq(t.id, id) });
  return c.json(created, 201);
});

timetables.put("/:id", authMiddleware, zValidator("json", updateTimetableSchema), async (c) => {
  const internalUserId = c.get("internalUserId");
  const id = c.req.param("id");
  const body = c.req.valid("json");
  const db = c.get("db");

  const existing = await db.query.timetables.findFirst({ where: (t, { eq }) => eq(t.id, id) });
  if (!existing) return c.json({ error: "Not found" }, 404);
  if (existing.userId !== internalUserId) return c.json({ error: "Forbidden" }, 403);

  const updates: Record<string, unknown> = { updatedAt: new Date() };
  if (body.name !== undefined) updates.name = body.name;
  if (body.description !== undefined) updates.description = body.description;
  if (body.entries !== undefined) updates.entries = body.entries;
  if (body.isActive !== undefined) updates.isActive = body.isActive;

  await db.update(db.schema.timetables).set(updates).where(eq(db.schema.timetables.id, id));
  const updated = await db.query.timetables.findFirst({ where: (t, { eq }) => eq(t.id, id) });
  return c.json(updated);
});

timetables.delete("/:id", authMiddleware, async (c) => {
  const internalUserId = c.get("internalUserId");
  const id = c.req.param("id");
  const db = c.get("db");
  const existing = await db.query.timetables.findFirst({ where: (t, { eq }) => eq(t.id, id) });
  if (!existing) return c.json({ error: "Not found" }, 404);
  if (existing.userId !== internalUserId) return c.json({ error: "Forbidden" }, 403);
  await db.delete(db.schema.timetables).where(eq(db.schema.timetables.id, id));
  return c.json({ success: true });
});

export default timetables;
