import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { eq, desc, and, sql } from "drizzle-orm";
import type { Env } from "../index";
import { authMiddleware } from "../middleware/auth";
import { gradeRecall as aiGradeRecall, feynmanGrade as aiFeynmanGrade } from "../services/ai";

const recallArena = new Hono<{ Bindings: Env; Variables: Record<string, any> }>();

const DEFAULT_PAGE_SIZE = 20;

const sessionSchema = z.object({
  title: z.string().min(1).max(300),
  mode: z.enum(["free_recall", "cued_recall", "feynman"]),
  subject: z.string().optional(),
  recallContent: z.string().optional(),
  correctContent: z.string().optional(),
  durationSeconds: z.number().int().positive().optional(),
});

const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(DEFAULT_PAGE_SIZE),
  mode: z.enum(["free_recall", "cued_recall", "feynman"]).optional(),
  subject: z.string().optional(),
});

// ════════════════════════════════════════════════════════════════
// GET /api/recall-arena — List recall sessions
// ════════════════════════════════════════════════════════════════
recallArena.get("/", authMiddleware, zValidator("query", paginationSchema), async (c) => {
  const internalUserId = c.get("internalUserId");
  const { page, limit, mode, subject } = c.req.valid("query");
  const db = c.get("db");
  const offset = (page - 1) * limit;

  const conditions = [eq(db.schema.recallSessions.userId, internalUserId)];
  if (mode) conditions.push(eq(db.schema.recallSessions.mode, mode));
  if (subject) conditions.push(eq(db.schema.recallSessions.subject, subject));
  const where = and(...conditions);

  const [results, countResult] = await Promise.all([
    db.select().from(db.schema.recallSessions).where(where)
      .orderBy(desc(db.schema.recallSessions.createdAt)).limit(limit).offset(offset),
    db.select({ count: sql<number>`count(*)` }).from(db.schema.recallSessions).where(where),
  ]);

  return c.json({
    data: results,
    pagination: { page, limit, total: countResult[0]?.count ?? 0,
      totalPages: Math.ceil((countResult[0]?.count ?? 0) / limit) },
  });
});

// ════════════════════════════════════════════════════════════════
// GET /api/recall-arena/:id — Get session
// ════════════════════════════════════════════════════════════════
recallArena.get("/:id", authMiddleware, async (c) => {
  const id = c.req.param("id");
  const internalUserId = c.get("internalUserId");
  const db = c.get("db");
  const session = await db.query.recallSessions.findFirst({ where: (s, { eq }) => eq(s.id, id) });
  if (!session) return c.json({ error: "Not found" }, 404);
  if (session.userId !== internalUserId) return c.json({ error: "Forbidden" }, 403);
  return c.json(session);
});

// ════════════════════════════════════════════════════════════════
// POST /api/recall-arena — Create recall session
// ════════════════════════════════════════════════════════════════
recallArena.post("/", authMiddleware, zValidator("json", sessionSchema), async (c) => {
  const internalUserId = c.get("internalUserId");
  const body = c.req.valid("json");
  const db = c.get("db");
  const id = crypto.randomUUID();
  const now = new Date();

  await db.insert(db.schema.recallSessions).values({
    id, userId: internalUserId, title: body.title, mode: body.mode,
    subject: body.subject ?? null, recallContent: body.recallContent ?? null,
    correctContent: body.correctContent ?? null,
    durationSeconds: body.durationSeconds ?? null,
    createdAt: now, updatedAt: now,
  });

  const created = await db.query.recallSessions.findFirst({ where: (s, { eq }) => eq(s.id, id) });
  return c.json(created, 201);
});

// ════════════════════════════════════════════════════════════════
// POST /api/recall-arena/:id/grade — Grade a recall session
// ════════════════════════════════════════════════════════════════
recallArena.post("/:id/grade", authMiddleware, async (c) => {
  const internalUserId = c.get("internalUserId");
  const id = c.req.param("id");
  const db = c.get("db");

  const session = await db.query.recallSessions.findFirst({ where: (s, { eq }) => eq(s.id, id) });
  if (!session) return c.json({ error: "Not found" }, 404);
  if (session.userId !== internalUserId) return c.json({ error: "Forbidden" }, 403);

  if (!session.recallContent) {
    return c.json({ error: "No recall content to grade" }, 400);
  }

  try {
    let result;

    if (session.mode === "feynman") {
      // Feynman teach-back grading
      result = await aiFeynmanGrade(c.env, session.subject || session.title, session.recallContent);
      await db.update(db.schema.recallSessions).set({
        grade: result.grade / 10, // Convert 0-100 to 0-10
        feedback: result.feedback,
        conceptsHit: result.gapsIdentified ? [] : [],
        conceptsMissed: result.gapsIdentified ?? [],
        updatedAt: new Date(),
      }).where(eq(db.schema.recallSessions.id, id));
    } else {
      // Free/cued recall grading
      if (!session.correctContent) {
        return c.json({ error: "No correct content to compare against" }, 400);
      }
      result = await aiGradeRecall(c.env, session.recallContent, session.correctContent);
      await db.update(db.schema.recallSessions).set({
        grade: result.grade / 10,
        feedback: result.feedback,
        conceptsHit: result.correctConcepts ?? [],
        conceptsMissed: result.missedConcepts ?? [],
        updatedAt: new Date(),
      }).where(eq(db.schema.recallSessions.id, id));
    }

    const updated = await db.query.recallSessions.findFirst({ where: (s, { eq }) => eq(s.id, id) });
    return c.json(updated);
  } catch (err) {
    console.error("Recall grading failed:", err);
    return c.json({ error: "Grading failed", details: String(err) }, 500);
  }
});

// ════════════════════════════════════════════════════════════════
// DELETE /api/recall-arena/:id — Delete recall session
// ════════════════════════════════════════════════════════════════
recallArena.delete("/:id", authMiddleware, async (c) => {
  const internalUserId = c.get("internalUserId");
  const id = c.req.param("id");
  const db = c.get("db");
  const session = await db.query.recallSessions.findFirst({ where: (s, { eq }) => eq(s.id, id) });
  if (!session) return c.json({ error: "Not found" }, 404);
  if (session.userId !== internalUserId) return c.json({ error: "Forbidden" }, 403);
  await db.delete(db.schema.recallSessions).where(eq(db.schema.recallSessions.id, id));
  return c.json({ success: true });
});

export default recallArena;
