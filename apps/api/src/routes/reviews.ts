import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { eq, desc, and, lt } from "drizzle-orm";
import type { Env } from "../index";
import { authMiddleware } from "../middleware/auth";
import { TABLES } from "../db/schema";
import { schedule, cardFromQuestion, retrievability, type Card, type Rating } from "../services/fsrs";

const reviews = new Hono<{ Bindings: Env; Variables: Record<string, any> }>();

// ── Schemas ──────────────────────────────────────────────────────
const logReviewSchema = z.object({
  questionId: z.string().min(1),
  rating: z.number().int().min(1).max(4), // 1=Again, 2=Hard, 3=Good, 4=Easy
});

// ════════════════════════════════════════════════════════════════
// GET /api/reviews/today — Due reviews for the current user
// ════════════════════════════════════════════════════════════════
reviews.get("/today", authMiddleware, async (c) => {
  const requestId = crypto.randomUUID();
  const internalUserId = c.get("internalUserId");
  const db = c.get("db");
  const now = Date.now();

  console.log("[stage.reviews.today]", JSON.stringify({ requestId }));

  try {
    // Get cards due now (fsrs_due <= now)
    const dueCards = await db.select()
      .from(TABLES.questions)
      .where(and(
        eq(TABLES.questions.userId, internalUserId),
        lt(TABLES.questions.fsrsDue as any, now / 1000), // stored as unix timestamp
      ))
      .orderBy(TABLES.questions.fsrsDue)
      .limit(20);

    // Enrich with retrievability
    const enriched = dueCards.map((q: any) => {
      const card = cardFromQuestion(q);
      const r = retrievability(card.elapsedDays, card.stability);
      return {
        id: q.id,
        questionText: q.questionText,
        subject: q.subject,
        topic: q.topic,
        difficulty: q.difficulty,
        fsrsState: q.fsrsState,
        fsrsStability: card.stability,
        fsrsDifficulty: card.difficulty,
        fsrsDue: q.fsrsDue,
        retrievability: Math.round(r * 100) / 100,
        reps: q.fsrsReps,
        lapses: q.fsrsLapses,
      };
    });

    return c.json({
      data: enriched,
      count: enriched.length,
      requestId,
    });
  } catch (e: any) {
    console.error("[reviews.today.fail]", JSON.stringify({ requestId, msg: String(e?.message ?? "").slice(0, 200) }));
    return c.json({ error: "internal_error", reason: "db_error", stage: "handler", detail: String(e?.message ?? "").slice(0, 200), requestId }, 500);
  }
});

// ════════════════════════════════════════════════════════════════
// POST /api/reviews/log — Record a review + update FSRS schedule
// ════════════════════════════════════════════════════════════════
reviews.post("/log", authMiddleware, zValidator("json", logReviewSchema), async (c) => {
  const requestId = crypto.randomUUID();
  const internalUserId = c.get("internalUserId");
  const { questionId, rating } = c.req.valid("json");
  const db = c.get("db");

  console.log("[stage.reviews.log]", JSON.stringify({ requestId, questionId, rating }));

  try {
    const question = await db.query.questions.findFirst({
      where: (q: any, { eq }: any) => eq(q.id, questionId),
    });
    if (!question) return c.json({ error: "not_found", reason: "question_not_found", stage: "handler", requestId }, 404);
    if (question.userId !== internalUserId) return c.json({ error: "forbidden", reason: "not_owner", stage: "handler", requestId }, 403);

    // Run FSRS scheduling
    const card: Card = cardFromQuestion(question);
    const updated = schedule(card, rating as Rating, Date.now());

    // Map back to question fields
    await db.update(TABLES.questions)
      .set({
        fsrsStability: updated.stability,
        fsrsDifficulty: updated.difficulty,
        fsrsState: updated.state,
        fsrsDue: Math.floor(updated.due / 1000),
        fsrsElapsedDays: updated.elapsedDays,
        fsrsScheduledDays: updated.scheduledDays,
        fsrsReps: updated.reps,
        fsrsLapses: updated.lapses,
        fsrsLastReview: updated.lastReview ? Math.floor(updated.lastReview / 1000) : null,
        lastAnswerCorrect: rating >= 3 ? 1 : 0,
        lastAnsweredAt: Math.floor(Date.now() / 1000),
        mistakeCount: rating === 1 ? (question.mistakeCount ?? 0) + 1 : question.mistakeCount,
        isMistake: rating === 1 ? 1 : 0,
      } as any)
      .where(eq(TABLES.questions.id, questionId));

    return c.json({
      status: "ok",
      nextReview: new Date(updated.due).toISOString(),
      scheduledDays: updated.scheduledDays,
      stability: Math.round(updated.stability * 100) / 100,
      difficulty: Math.round(updated.difficulty * 100) / 100,
      state: updated.state,
      requestId,
    });
  } catch (e: any) {
    console.error("[reviews.log.fail]", JSON.stringify({ requestId, msg: String(e?.message ?? "").slice(0, 200) }));
    return c.json({ error: "internal_error", reason: "db_error", stage: "handler", detail: String(e?.message ?? "").slice(0, 200), requestId }, 500);
  }
});

// ════════════════════════════════════════════════════════════════
// GET /api/reviews/stats — User's FSRS stats
// ════════════════════════════════════════════════════════════════
reviews.get("/stats", authMiddleware, async (c) => {
  const internalUserId = c.get("internalUserId");
  const db = c.get("db");

  const now = Math.floor(Date.now() / 1000);
  const twentyFourH = now - 86400;
  const sevenDays = now - 86400 * 7;

  const [dueCount, reviewed24h, reviewed7d, totalCards] = await Promise.all([
    db.select({ count: db._.sql<number>`count(*)` })
      .from(TABLES.questions)
      .where(and(
        eq(TABLES.questions.userId, internalUserId),
        lt(TABLES.questions.fsrsDue as any, now),
        eq(TABLES.questions.fsrsState, db._.sql`2`), // Review state
      )),
    db.select({ count: db._.sql<number>`count(*)` })
      .from(TABLES.questions)
      .where(and(
        eq(TABLES.questions.userId, internalUserId),
        lt(db._.sql`${twentyFourH}`, TABLES.questions.lastAnsweredAt as any),
      )),
    db.select({ count: db._.sql<number>`count(*)` })
      .from(TABLES.questions)
      .where(and(
        eq(TABLES.questions.userId, internalUserId),
        lt(db._.sql`${sevenDays}`, TABLES.questions.lastAnsweredAt as any),
      )),
    db.select({ count: db._.sql<number>`count(*)` })
      .from(TABLES.questions)
      .where(eq(TABLES.questions.userId, internalUserId)),
  ]);

  return c.json({
    dueCount: dueCount[0]?.count ?? 0,
    reviewed24h: reviewed24h[0]?.count ?? 0,
    reviewed7d: reviewed7d[0]?.count ?? 0,
    totalCards: totalCards[0]?.count ?? 0,
  });
});

export default reviews;
