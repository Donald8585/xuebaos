import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { eq, and, gte, lte, sql } from "drizzle-orm";
import type { Env } from "../index";
import { authMiddleware } from "../middleware/auth";

const analytics = new Hono<{ Bindings: Env; Variables: Record<string, any> }>();

const periodSchema = z.object({
  days: z.coerce.number().int().min(1).max(365).default(30),
});

// ════════════════════════════════════════════════════════════════
// GET /api/analytics/overview — Study stats dashboard
// ════════════════════════════════════════════════════════════════
analytics.get("/overview", authMiddleware, zValidator("query", periodSchema), async (c) => {
  const internalUserId = c.get("internalUserId");
  const { days } = c.req.valid("query");
  const db = c.get("db");
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  // Total study time
  const totalMinutes = await db
    .select({
      total: sql<number>`coalesce(sum(duration_minutes), 0)`,
      avgFocus: sql<number>`coalesce(avg(focus_score), 0)`,
      sessionCount: sql<number>`count(*)`,
    })
    .from(db.schema.studySessions)
    .where(
      and(
        eq(db.schema.studySessions.userId, internalUserId),
        gte(db.schema.studySessions.createdAt, since)
      )
    );

  // Questions answered
  const questionsAnswered = await db
    .select({ count: sql<number>`count(*)` })
    .from(db.schema.questions)
    .where(
      and(
        eq(db.schema.questions.userId, internalUserId),
        gte(db.schema.questions.lastAnsweredAt, since)
      )
    );

  // Questions answered correctly
  const questionsCorrect = await db
    .select({ count: sql<number>`count(*)` })
    .from(db.schema.questions)
    .where(
      and(
        eq(db.schema.questions.userId, internalUserId),
        gte(db.schema.questions.lastAnsweredAt, since),
        eq(db.schema.questions.lastAnswerCorrect, true)
      )
    );

  // Study by subject
  const bySubject = await db
    .select({
      subject: db.schema.studySessions.subject,
      minutes: sql<number>`coalesce(sum(duration_minutes), 0)`,
      count: sql<number>`count(*)`,
    })
    .from(db.schema.studySessions)
    .where(
      and(
        eq(db.schema.studySessions.userId, internalUserId),
        gte(db.schema.studySessions.createdAt, since)
      )
    )
    .groupBy(db.schema.studySessions.subject);

  // Total items created
  const [palaceCount, storyCount, symbolCount, questionCount] = await Promise.all([
    db.select({ count: sql<number>`count(*)` }).from(db.schema.memoryPalaces)
      .where(eq(db.schema.memoryPalaces.userId, internalUserId)),
    db.select({ count: sql<number>`count(*)` }).from(db.schema.mnemonicStories)
      .where(eq(db.schema.mnemonicStories.userId, internalUserId)),
    db.select({ count: sql<number>`count(*)` }).from(db.schema.symbols)
      .where(eq(db.schema.symbols.userId, internalUserId)),
    db.select({ count: sql<number>`count(*)` }).from(db.schema.questions)
      .where(eq(db.schema.questions.userId, internalUserId)),
  ]);

  const answered = questionsAnswered[0]?.count ?? 0;
  const correct = questionsCorrect[0]?.count ?? 0;

  return c.json({
    period: { days, since },
    totalMinutes: totalMinutes[0]?.total ?? 0,
    avgFocusScore: Math.round((totalMinutes[0]?.avgFocus ?? 0) * 100) / 100,
    sessionCount: totalMinutes[0]?.sessionCount ?? 0,
    questionsAnswered: answered,
    questionsCorrect: correct,
    accuracy: answered > 0 ? Math.round((correct / answered) * 100) : 0,
    bySubject,
    totals: {
      palaces: palaceCount[0]?.count ?? 0,
      stories: storyCount[0]?.count ?? 0,
      symbols: symbolCount[0]?.count ?? 0,
      questions: questionCount[0]?.count ?? 0,
    },
  });
});

// ════════════════════════════════════════════════════════════════
// GET /api/analytics/rank — Study God rank
// ════════════════════════════════════════════════════════════════
analytics.get("/rank", authMiddleware, async (c) => {
  const internalUserId = c.get("internalUserId");
  const db = c.get("db");
  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  // Compute score from multiple dimensions
  const [studyResult, questionsResult, recallResult] = await Promise.all([
    db.select({
      totalMinutes: sql<number>`coalesce(sum(duration_minutes), 0)`,
      avgFocus: sql<number>`coalesce(avg(focus_score), 0)`,
      sessions: sql<number>`count(*)`,
    }).from(db.schema.studySessions).where(
      and(eq(db.schema.studySessions.userId, internalUserId), gte(db.schema.studySessions.createdAt, since))
    ),
    db.select({
      total: sql<number>`count(*)`,
      correct: sql<number>`sum(case when last_answer_correct then 1 else 0 end)`,
    }).from(db.schema.questions).where(eq(db.schema.questions.userId, internalUserId)),
    db.select({
      count: sql<number>`count(*)`,
      avgGrade: sql<number>`coalesce(avg(grade), 0)`,
    }).from(db.schema.recallSessions).where(
      and(eq(db.schema.recallSessions.userId, internalUserId), gte(db.schema.recallSessions.createdAt, since))
    ),
  ]);

  const studyMinutes = studyResult[0]?.totalMinutes ?? 0;
  const focusScore = studyResult[0]?.avgFocus ?? 0;
  const sessions = studyResult[0]?.sessions ?? 0;
  const qTotal = questionsResult[0]?.total ?? 0;
  const qCorrect = questionsResult[0]?.correct ?? 0;
  const qAccuracy = qTotal > 0 ? qCorrect / qTotal : 0;
  const recallGrade = recallResult[0]?.avgGrade ?? 0;

  // Composite score (0-1000)
  const studyScore = Math.min(studyMinutes / 10, 200); // 200 max
  const focusBonus = focusScore * 2; // 200 max
  const consistencyBonus = Math.min(sessions * 5, 200); // 200 max
  const accuracyBonus = qAccuracy * 200; // 200 max
  const recallBonus = Math.min(recallGrade * 20, 200); // 200 max
  const compositeScore = Math.round(studyScore + focusBonus + consistencyBonus + accuracyBonus + recallBonus);

  // Rank tiers
  const getRank = (score: number) => {
    if (score >= 900) return { rank: "Xueshen 學神", tier: 5, emoji: "👑" };
    if (score >= 750) return { rank: "Xueba 學霸", tier: 4, emoji: "🎓" };
    if (score >= 600) return { rank: "GaoShou 高手", tier: 3, emoji: "⚔️" };
    if (score >= 400) return { rank: "XueZhe 學者", tier: 2, emoji: "📚" };
    if (score >= 200) return { rank: "XueSheng 學生", tier: 1, emoji: "📖" };
    return { rank: "XueTu 學徒", tier: 0, emoji: "🌱" };
  };

  return c.json({
    score: compositeScore,
    breakdown: {
      studyScore: Math.round(studyScore),
      focusBonus: Math.round(focusBonus),
      consistencyBonus: Math.round(consistencyBonus),
      accuracyBonus: Math.round(accuracyBonus),
      recallBonus: Math.round(recallBonus),
    },
    ...getRank(compositeScore),
    stats: {
      studyMinutes: Math.round(studyMinutes),
      avgFocus: Math.round(focusScore),
      sessions,
      questionsAnswered: qTotal,
      accuracy: qTotal > 0 ? Math.round((qCorrect / qTotal) * 100) : 0,
      avgRecallGrade: Math.round(recallGrade * 10) / 10,
    },
  });
});

// ════════════════════════════════════════════════════════════════
// GET /api/analytics/recall-curve — FSRS recall data
// ════════════════════════════════════════════════════════════════
analytics.get("/recall-curve", authMiddleware, async (c) => {
  const internalUserId = c.get("internalUserId");
  const db = c.get("db");

  // Get all questions with FSRS data
  const questions = await db
    .select({
      fsrsState: db.schema.questions.fsrsState,
      fsrsStability: db.schema.questions.fsrsStability,
      fsrsDifficulty: db.schema.questions.fsrsDifficulty,
      fsrsReps: db.schema.questions.fsrsReps,
      fsrsLapses: db.schema.questions.fsrsLapses,
      lastAnswerCorrect: db.schema.questions.lastAnswerCorrect,
      createdAt: db.schema.questions.createdAt,
    })
    .from(db.schema.questions)
    .where(eq(db.schema.questions.userId, internalUserId));

  // Aggregate recall curve data
  const stabilityRanges = [
    { label: "0-1d", min: 0, max: 1 },
    { label: "1-3d", min: 1, max: 3 },
    { label: "3-7d", min: 3, max: 7 },
    { label: "7-14d", min: 7, max: 14 },
    { label: "14-30d", min: 14, max: 30 },
    { label: "30d+", min: 30, max: Infinity },
  ];

  const curve = stabilityRanges.map((range) => {
    const inRange = questions.filter(
      (q) =>
        (q.fsrsStability ?? 0) >= range.min &&
        (q.fsrsStability ?? 0) < range.max
    );
    const correct = inRange.filter((q) => q.lastAnswerCorrect === true).length;
    return {
      range: range.label,
      count: inRange.length,
      correct,
      accuracy: inRange.length > 0 ? Math.round((correct / inRange.length) * 100) : 0,
    };
  });

  // State distribution
  const newCount = questions.filter((q) => q.fsrsState === 0).length;
  const learningCount = questions.filter((q) => q.fsrsState === 1).length;
  const reviewCount = questions.filter((q) => q.fsrsState === 2).length;
  const relearningCount = questions.filter((q) => q.fsrsState === 3).length;

  // Average difficulty
  const avgDifficulty =
    questions.length > 0
      ? questions.reduce((sum, q) => sum + (q.fsrsDifficulty ?? 0.3), 0) / questions.length
      : 0.3;

  // Total reviews over time (by week for last 12 weeks)
  const now = new Date();
  const weeklyReviews: Array<{ week: string; reviews: number; correct: number }> = [];
  for (let i = 11; i >= 0; i--) {
    const weekStart = new Date(now.getTime() - (i + 1) * 7 * 24 * 60 * 60 * 1000);
    const weekEnd = new Date(now.getTime() - i * 7 * 24 * 60 * 60 * 1000);
    const weekQuestions = questions.filter(
      (q) =>
        q.createdAt && new Date(q.createdAt) >= weekStart && new Date(q.createdAt) < weekEnd
    );
    weeklyReviews.push({
      week: weekStart.toISOString().slice(0, 10),
      reviews: weekQuestions.length,
      correct: weekQuestions.filter((q) => q.lastAnswerCorrect === true).length,
    });
  }

  return c.json({
    totalQuestions: questions.length,
    stateDistribution: {
      new: newCount,
      learning: learningCount,
      review: reviewCount,
      relearning: relearningCount,
    },
    avgDifficulty: Math.round(avgDifficulty * 100) / 100,
    totalReps: questions.reduce((sum, q) => sum + (q.fsrsReps ?? 0), 0),
    totalLapses: questions.reduce((sum, q) => sum + (q.fsrsLapses ?? 0), 0),
    recallCurve: curve,
    weeklyReviews,
  });
});

export default analytics;
