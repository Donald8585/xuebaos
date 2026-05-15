import { Hono } from "hono";
import { eq } from "drizzle-orm";
import type { Env } from "../index";
import { authMiddleware } from "../middleware/auth";

const stats = new Hono<{ Bindings: Env; Variables: Record<string, any> }>();

// GET /api/stats — Dashboard study stats
stats.get("/", authMiddleware, async (c) => {
  const internalUserId = c.get("internalUserId");
  const db = c.get("db");

  try {
    const [sessionCount, palaceCount, storyCount] = await Promise.all([
      db.select({ count: db.schema.studySessions.id }).from(db.schema.studySessions)
        .where(eq(db.schema.studySessions.userId, internalUserId)),
      db.select({ count: db.schema.memoryPalaces.id }).from(db.schema.memoryPalaces)
        .where(eq(db.schema.memoryPalaces.userId, internalUserId)),
      db.select({ count: db.schema.mnemonicStories.id }).from(db.schema.mnemonicStories)
        .where(eq(db.schema.mnemonicStories.userId, internalUserId)),
      db.select({ count: db.schema.questions.id }).from(db.schema.questions)
        .where(eq(db.schema.questions.userId, internalUserId)),
      db.select({ count: db.schema.technocraticAudits.id }).from(db.schema.technocraticAudits)
        .where(eq(db.schema.technocraticAudits.userId, internalUserId)),
    ]);

    return c.json({
      total_sessions: sessionCount.length,
      total_duration_seconds: 0,
      total_cards_reviewed: 0,
      average_accuracy: 0,
      streak_days: 0,
      longest_streak: 0,
      saturation_level: Math.min((palaceCount.length + storyCount.length) * 10, 100),
      last_audit_at: null,
      weekly_activity: [],
      topic_mastery: [],
    });
  } catch (err) {
    console.error("Stats error:", err);
    return c.json({ error: "Failed to load stats" }, 500);
  }
});

export default stats;
