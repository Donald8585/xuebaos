import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { eq, desc, and, sql, gte, lte } from "drizzle-orm";
import type { Env } from "../index";
import { authMiddleware } from "../middleware/auth";

const sessions = new Hono<{ Bindings: Env; Variables: Record<string, any> }>();

const DEFAULT_PAGE_SIZE = 20;

const createSessionSchema = z.object({
  subject: z.string().min(1),
  topic: z.string().optional(),
  durationMinutes: z.number().int().positive().optional(),
  focusScore: z.number().min(0).max(100).optional(),
  notes: z.string().optional(),
  mode: z.enum(["focused", "pomodoro", "deep"]).default("focused"),
  completedAt: z.string().datetime().optional(),
});

const updateSessionSchema = createSessionSchema.partial();

const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(DEFAULT_PAGE_SIZE),
  subject: z.string().optional(),
  from: z.string().optional(), // ISO date
  to: z.string().optional(),   // ISO date
});

sessions.get("/", authMiddleware, zValidator("query", paginationSchema), async (c) => {
  const internalUserId = c.get("internalUserId");
  const { page, limit, subject, from, to } = c.req.valid("query");
  const db = c.get("db");
  const offset = (page - 1) * limit;

  const conditions = [eq(db.schema.studySessions.userId, internalUserId)];
  if (subject) conditions.push(eq(db.schema.studySessions.subject, subject));
  if (from) conditions.push(gte(db.schema.studySessions.createdAt, new Date(from)));
  if (to) conditions.push(lte(db.schema.studySessions.createdAt, new Date(to)));
  const where = and(...conditions);

  const [results, countResult] = await Promise.all([
    db.select().from(db.schema.studySessions).where(where)
      .orderBy(desc(db.schema.studySessions.createdAt)).limit(limit).offset(offset),
    db.select({ count: sql<number>`count(*)` }).from(db.schema.studySessions).where(where),
  ]);

  return c.json({
    data: results,
    pagination: { page, limit, total: countResult[0]?.count ?? 0,
      totalPages: Math.ceil((countResult[0]?.count ?? 0) / limit) },
  });
});

sessions.get("/:id", authMiddleware, async (c) => {
  const id = c.req.param("id");
  const internalUserId = c.get("internalUserId");
  const db = c.get("db");
  const session = await db.query.studySessions.findFirst({ where: (s, { eq }) => eq(s.id, id) });
  if (!session) return c.json({ error: "Not found" }, 404);
  if (session.userId !== internalUserId) return c.json({ error: "Forbidden" }, 403);
  return c.json(session);
});

sessions.post("/", authMiddleware, zValidator("json", createSessionSchema), async (c) => {
  const internalUserId = c.get("internalUserId");
  const body = c.req.valid("json");
  const db = c.get("db");
  const id = crypto.randomUUID();
  const now = new Date();

  await db.insert(db.schema.studySessions).values({
    id, userId: internalUserId, subject: body.subject, topic: body.topic ?? null,
    durationMinutes: body.durationMinutes ?? null, focusScore: body.focusScore ?? null,
    notes: body.notes ?? null, mode: body.mode ?? "focused",
    completedAt: body.completedAt ? new Date(body.completedAt) : null,
    createdAt: now, updatedAt: now,
  });

  const created = await db.query.studySessions.findFirst({ where: (s, { eq }) => eq(s.id, id) });
  return c.json(created, 201);
});

sessions.put("/:id", authMiddleware, zValidator("json", updateSessionSchema), async (c) => {
  const internalUserId = c.get("internalUserId");
  const id = c.req.param("id");
  const body = c.req.valid("json");
  const db = c.get("db");

  const existing = await db.query.studySessions.findFirst({ where: (s, { eq }) => eq(s.id, id) });
  if (!existing) return c.json({ error: "Not found" }, 404);
  if (existing.userId !== internalUserId) return c.json({ error: "Forbidden" }, 403);

  const updates: Record<string, unknown> = { updatedAt: new Date() };
  for (const [k, v] of Object.entries(body)) {
    if (v !== undefined) {
      (updates as any)[k] = k === "completedAt" && v ? new Date(v as string) : v;
    }
  }

  await db.update(db.schema.studySessions).set(updates).where(eq(db.schema.studySessions.id, id));
  const updated = await db.query.studySessions.findFirst({ where: (s, { eq }) => eq(s.id, id) });
  return c.json(updated);
});

sessions.delete("/:id", authMiddleware, async (c) => {
  const internalUserId = c.get("internalUserId");
  const id = c.req.param("id");
  const db = c.get("db");
  const existing = await db.query.studySessions.findFirst({ where: (s, { eq }) => eq(s.id, id) });
  if (!existing) return c.json({ error: "Not found" }, 404);
  if (existing.userId !== internalUserId) return c.json({ error: "Forbidden" }, 403);
  await db.delete(db.schema.studySessions).where(eq(db.schema.studySessions.id, id));
  return c.json({ success: true });
});

export default sessions;
