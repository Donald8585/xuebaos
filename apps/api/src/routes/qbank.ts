import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { eq, desc, and, sql, lte } from "drizzle-orm";
import type { Env } from "../index";
import { authMiddleware } from "../middleware/auth";
import { checkLimit } from "../middleware/tier-gate";
import { schedule, cardFromQuestion } from "../services/fsrs";
import { generateQuestions } from "../services/ai";
import type { Rating } from "../services/fsrs";

const qbank = new Hono<{ Bindings: Env; Variables: Record<string, any> }>();

const DEFAULT_PAGE_SIZE = 20;

// ── Schemas ──────────────────────────────────────────────────────
const createQuestionSchema = z.object({
  subject: z.string().min(1),
  topic: z.string().optional(),
  questionType: z.enum(["mcq", "short_answer", "essay", "fill_blank"]).default("mcq"),
  difficulty: z.enum(["easy", "medium", "hard"]).default("medium"),
  questionText: z.string().min(1),
  options: z.array(z.string()).optional(),
  correctAnswer: z.string().optional(),
  explanation: z.string().optional(),
  tags: z.array(z.string()).optional(),
});

const updateQuestionSchema = createQuestionSchema.partial();

const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(DEFAULT_PAGE_SIZE),
  subject: z.string().optional(),
  topic: z.string().optional(),
  difficulty: z.enum(["easy", "medium", "hard"]).optional(),
  questionType: z.enum(["mcq", "short_answer", "essay", "fill_blank"]).optional(),
  isMistake: z.coerce.boolean().optional(),
});

const aiGenerateSchema = z.object({
  subject: z.string().min(1),
  topic: z.string().min(1),
  content: z.string(),
  mode: z.enum(["standard", "deep-wide", "novelty"]).default("standard"),
  difficulty: z.enum(["easy", "medium", "hard"]).default("medium"),
  count: z.number().int().min(1).max(50).default(10),
});


const ratingSchema = z.object({
  rating: z.number().int().min(1).max(4), // 1=Again, 2=Hard, 3=Good, 4=Easy
});

// ════════════════════════════════════════════════════════════════
// GET /api/qbank — List questions
// ════════════════════════════════════════════════════════════════
qbank.get("/", authMiddleware, zValidator("query", paginationSchema), async (c) => {
  const internalUserId = c.get("internalUserId");
  const { page, limit, subject, topic, difficulty, questionType, isMistake } = c.req.valid("query");
  const db = c.get("db");
  const offset = (page - 1) * limit;

  const conditions = [eq(db.schema.questions.userId, internalUserId)];
  if (subject) conditions.push(eq(db.schema.questions.subject, subject));
  if (topic) conditions.push(eq(db.schema.questions.topic, topic));
  if (difficulty) conditions.push(eq(db.schema.questions.difficulty, difficulty));
  if (questionType) conditions.push(eq(db.schema.questions.questionType, questionType));
  if (isMistake !== undefined) conditions.push(eq(db.schema.questions.isMistake, isMistake));
  const where = and(...conditions);

  const [results, countResult] = await Promise.all([
    db.select().from(db.schema.questions).where(where)
      .orderBy(desc(db.schema.questions.updatedAt)).limit(limit).offset(offset),
    db.select({ count: sql<number>`count(*)` }).from(db.schema.questions).where(where),
  ]);

  return c.json({
    data: results,
    pagination: { page, limit, total: countResult[0]?.count ?? 0,
      totalPages: Math.ceil((countResult[0]?.count ?? 0) / limit) },
  });
});

// ════════════════════════════════════════════════════════════════
// GET /api/qbank/due/count — Count due questions (for FSRS)
// ════════════════════════════════════════════════════════════════
qbank.get("/due/count", authMiddleware, async (c) => {
  const internalUserId = c.get("internalUserId");
  const db = c.get("db");
  const now = Date.now();

  const dueQuestions = await db
    .select({ count: sql<number>`count(*)` })
    .from(db.schema.questions)
    .where(
      and(
        eq(db.schema.questions.userId, internalUserId),
        lte(db.schema.questions.fsrsDue, new Date(now))
      )
    );

  return c.json({ dueCount: dueQuestions[0]?.count ?? 0 });
});

// ════════════════════════════════════════════════════════════════
// GET /api/qbank/coverage — Subject/topic coverage
// ════════════════════════════════════════════════════════════════
qbank.get("/coverage", authMiddleware, async (c) => {
  const db = c.get("db");
  const internalUserId = c.get("internalUserId");

  const results = await db
    .select({
      subject: db.schema.questions.subject,
      topic: db.schema.questions.topic,
      count: sql<number>`count(*)`,
      avgDifficulty: sql<number>`avg(case when difficulty = 'easy' then 1 when difficulty = 'medium' then 2 else 3 end)`,
      mistakes: sql<number>`sum(case when is_mistake then 1 else 0 end)`,
    })
    .from(db.schema.questions)
    .where(eq(db.schema.questions.userId, internalUserId))
    .groupBy(db.schema.questions.subject, db.schema.questions.topic);

  return c.json(results);
});

// ════════════════════════════════════════════════════════════════
// GET /api/qbank/:id — Get single question
// ════════════════════════════════════════════════════════════════
qbank.get("/:id", authMiddleware, async (c) => {
  const id = c.req.param("id");
  const internalUserId = c.get("internalUserId");
  const db = c.get("db");
  const q = await db.query.questions.findFirst({ where: (q, { eq }) => eq(q.id, id) });
  if (!q) return c.json({ error: "Not found" }, 404);
  if (q.userId !== internalUserId) return c.json({ error: "Forbidden" }, 403);
  return c.json(q);
});

// ════════════════════════════════════════════════════════════════
// POST /api/qbank — Create question
// ════════════════════════════════════════════════════════════════
qbank.post("/", authMiddleware, checkLimit("questions"), zValidator("json", createQuestionSchema), async (c) => {
  const internalUserId = c.get("internalUserId");
  const body = c.req.valid("json");
  const db = c.get("db");
  const id = crypto.randomUUID();
  const now = new Date();

  await db.insert(db.schema.questions).values({
    id, userId: internalUserId, subject: body.subject, topic: body.topic ?? null,
    questionType: body.questionType ?? "mcq", difficulty: body.difficulty ?? "medium",
    questionText: body.questionText, options: body.options ?? null,
    correctAnswer: body.correctAnswer ?? null, explanation: body.explanation ?? null,
    source: "manual", tags: body.tags ?? [],
    fsrsState: 0, fsrsDue: now,
    createdAt: now, updatedAt: now,
  });

  const created = await db.query.questions.findFirst({ where: (q, { eq }) => eq(q.id, id) });
  return c.json(created, 201);
});

// ════════════════════════════════════════════════════════════════
// PUT /api/qbank/:id — Update question
// ════════════════════════════════════════════════════════════════
qbank.put("/:id", authMiddleware, zValidator("json", updateQuestionSchema), async (c) => {
  const internalUserId = c.get("internalUserId");
  const id = c.req.param("id");
  const body = c.req.valid("json");
  const db = c.get("db");

  const existing = await db.query.questions.findFirst({ where: (q, { eq }) => eq(q.id, id) });
  if (!existing) return c.json({ error: "Not found" }, 404);
  if (existing.userId !== internalUserId) return c.json({ error: "Forbidden" }, 403);

  const updates: Record<string, unknown> = { updatedAt: new Date() };
  for (const [k, v] of Object.entries(body)) {
    if (v !== undefined) (updates as any)[k] = v;
  }

  await db.update(db.schema.questions).set(updates).where(eq(db.schema.questions.id, id));
  const updated = await db.query.questions.findFirst({ where: (q, { eq }) => eq(q.id, id) });
  return c.json(updated);
});

// ════════════════════════════════════════════════════════════════
// DELETE /api/qbank/:id — Delete question
// ════════════════════════════════════════════════════════════════
qbank.delete("/:id", authMiddleware, async (c) => {
  const internalUserId = c.get("internalUserId");
  const id = c.req.param("id");
  const db = c.get("db");
  const existing = await db.query.questions.findFirst({ where: (q, { eq }) => eq(q.id, id) });
  if (!existing) return c.json({ error: "Not found" }, 404);
  if (existing.userId !== internalUserId) return c.json({ error: "Forbidden" }, 403);
  await db.delete(db.schema.questions).where(eq(db.schema.questions.id, id));
  return c.json({ success: true });
});

// ════════════════════════════════════════════════════════════════
// POST /api/qbank/:id/answer — Answer a question (FSRS scheduling)
// ════════════════════════════════════════════════════════════════
qbank.post("/:id/answer", authMiddleware, zValidator("json", ratingSchema), async (c) => {
  const internalUserId = c.get("internalUserId");
  const id = c.req.param("id");
  const { rating } = c.req.valid("json");
  const db = c.get("db");

  const q = await db.query.questions.findFirst({ where: (q, { eq }) => eq(q.id, id) });
  if (!q) return c.json({ error: "Not found" }, 404);
  if (q.userId !== internalUserId) return c.json({ error: "Forbidden" }, 403);

  const card = cardFromQuestion(q);
  const nextCard = schedule(card, rating as Rating);

  const now = new Date();
  const isMistake = rating <= 2; // Again or Hard = mistake
  const updates: Record<string, unknown> = {
    fsrsStability: nextCard.stability,
    fsrsDifficulty: nextCard.difficulty,
    fsrsState: nextCard.state,
    fsrsDue: new Date(nextCard.due),
    fsrsElapsedDays: nextCard.elapsedDays,
    fsrsScheduledDays: nextCard.scheduledDays,
    fsrsReps: nextCard.reps,
    fsrsLapses: nextCard.lapses,
    fsrsLastReview: new Date(nextCard.lastReview ?? Date.now()),
    lastAnsweredAt: now,
    lastAnswerCorrect: !isMistake,
    updatedAt: now,
  };

  if (isMistake) {
    updates.isMistake = true;
    updates.mistakeCount = (q.mistakeCount ?? 0) + 1;
  }

  await db.update(db.schema.questions).set(updates).where(eq(db.schema.questions.id, id));

  return c.json({
    nextDue: new Date(nextCard.due),
    stability: nextCard.stability,
    difficulty: nextCard.difficulty,
    state: nextCard.state,
    interval: nextCard.scheduledDays,
  });
});

// ════════════════════════════════════════════════════════════════
// POST /api/qbank/ai-generate — Generate questions with AI
// ════════════════════════════════════════════════════════════════
qbank.post("/ai-generate", authMiddleware, zValidator("json", aiGenerateSchema), async (c) => {
  const internalUserId = c.get("internalUserId");
  const { subject, topic, content, mode, difficulty, count } = c.req.valid("json");
  const db = c.get("db");

  try {
    const result = await generateQuestions(c.env, subject, topic, content, mode, difficulty, count);

    if (!result?.questions?.length) {
      return c.json({ error: "Failed to generate questions" }, 500);
    }

    const now = new Date();
    const createdIds: string[] = [];

    for (const q of result.questions) {
      const id = crypto.randomUUID();
      createdIds.push(id);
      await db.insert(db.schema.questions).values({
        id, userId: internalUserId, subject, topic,
        questionType: q.questionType || "mcq",
        difficulty: q.difficulty || difficulty,
        questionText: q.questionText,
        options: q.options ?? null,
        correctAnswer: q.correctAnswer ?? null,
        explanation: q.explanation ?? null,
        source: "ai-generated", generationMode: mode,
        tags: q.tags ?? [],
        fsrsState: 0, fsrsDue: now,
        createdAt: now, updatedAt: now,
      });
    }

    const created = await db
      .select()
      .from(db.schema.questions)
      .where(eq(db.schema.questions.userId, internalUserId))
      .orderBy(desc(db.schema.questions.createdAt))
      .limit(count);

    return c.json({ questions: created, count: created.length }, 201);
  } catch (err) {
    console.error("AI question generation failed:", err);
    return c.json({ error: "AI generation failed", details: String(err) }, 500);
  }
});

// ════════════════════════════════════════════════════════════════
// POST /api/qbank/mistake-log — Mark/unmark question as mistake
// ════════════════════════════════════════════════════════════════
qbank.post("/mistake-log", authMiddleware, zValidator("json", z.object({
  questionId: z.string(),
  isMistake: z.boolean(),
})), async (c) => {
  const internalUserId = c.get("internalUserId");
  const { questionId, isMistake } = c.req.valid("json");
  const db = c.get("db");

  const q = await db.query.questions.findFirst({
    where: (q, { eq }) => and(eq(q.id, questionId), eq(q.userId, internalUserId)),
  });
  if (!q) return c.json({ error: "Question not found" }, 404);

  await db.update(db.schema.questions)
    .set({
      isMistake,
      mistakeCount: isMistake ? (q.mistakeCount ?? 0) + 1 : q.mistakeCount,
      updatedAt: new Date(),
    })
    .where(eq(db.schema.questions.id, questionId));

  return c.json({ success: true });
});

// ════════════════════════════════════════════════════════════════
// POST /api/qbank/speed-drill — Get rapid-fire due questions
// ════════════════════════════════════════════════════════════════
qbank.post("/speed-drill", authMiddleware, zValidator("json", z.object({
  subject: z.string().optional(),
  count: z.number().int().min(1).max(50).default(10),
})), async (c) => {
  const internalUserId = c.get("internalUserId");
  const { subject, count } = c.req.valid("json");
  const db = c.get("db");
  const now = new Date();

  const conditions = [
    eq(db.schema.questions.userId, internalUserId),
    lte(db.schema.questions.fsrsDue, now),
  ];
  if (subject) conditions.push(eq(db.schema.questions.subject, subject));

  const questions = await db
    .select()
    .from(db.schema.questions)
    .where(and(...conditions))
    .limit(count);

  return c.json({ questions });
});

export default qbank;
