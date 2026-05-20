import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { eq, desc, and, sql } from "drizzle-orm";
import type { Env } from "../index";
import { authMiddleware } from "../middleware/auth";
import { schedule, cardFromQuestion, type Rating } from "../services/fsrs";

const anchors = new Hono<{ Bindings: Env; Variables: Record<string, any> }>();

// ── Schemas ──────────────────────────────────────────────────────
const createAnchorSchema = z.object({
  palaceId: z.string().min(1),
  locusIndex: z.number().int().min(0),
  concept: z.string().min(1),
  sourceVideoId: z.string().optional(),
  sourceTimestamp: z.number().optional(),
  thumbnailKey: z.string().optional(),
});

const reviewSchema = z.object({
  rating: z.number().int().min(1).max(4), // 1=Again, 2=Hard, 3=Good, 4=Easy
});

// ════════════════════════════════════════════════════════════════
// GET /api/anchors/due — FSRS-scheduled due anchors
// ════════════════════════════════════════════════════════════════
anchors.get("/due", authMiddleware, async (c) => {
  const internalUserId = c.get("internalUserId");
  const db = c.get("db");
  const now = Date.now();

  try {
    const results = await db.select()
      .from(db.schema.palaceAnchors)
      .where(
        and(
          eq(db.schema.palaceAnchors.userId, internalUserId),
          sql`(fsrs_due IS NULL OR fsrs_due <= ${now})`
        )
      )
      .orderBy(sql`fsrs_due ASC NULLS FIRST`)
      .limit(50);

    return c.json({ data: results, dueCount: results.length });
  } catch (e: any) {
    console.error("[anchors.due.fail]", String(e?.message ?? "").slice(0, 200));
    return c.json({ data: [], dueCount: 0, error: String(e?.message ?? "").slice(0, 200) });
  }
});

// ════════════════════════════════════════════════════════════════
// POST /api/anchors/review — Record FSRS review for an anchor
// ════════════════════════════════════════════════════════════════
anchors.post("/:id/review", authMiddleware, zValidator("json", reviewSchema), async (c) => {
  const requestId = crypto.randomUUID();
  const internalUserId = c.get("internalUserId");
  const id = c.req.param("id") as string;
  const { rating } = c.req.valid("json");
  const db = c.get("db");

  try {
    const anchor = await db.query.palaceAnchors.findFirst({
      where: (a: any, { eq }: any) => eq(a.id, id),
    });
    if (!anchor) return c.json({ error: "not_found" }, 404);
    if (anchor.userId !== internalUserId) return c.json({ error: "forbidden" }, 403);

    // Convert to FSRS card
    const card = cardFromQuestion({
      fsrsStability: anchor.fsrsStability,
      fsrsDifficulty: anchor.fsrsDifficulty,
      fsrsState: anchor.fsrsState,
      fsrsDue: anchor.fsrsDue,
      fsrsElapsedDays: anchor.fsrsElapsedDays,
      fsrsScheduledDays: anchor.fsrsScheduledDays,
      fsrsReps: anchor.fsrsReps,
      fsrsLapses: anchor.fsrsLapses,
      fsrsLastReview: anchor.fsrsLastReview,
    });

    // Schedule
    const next = schedule(card, rating as Rating, Date.now());

    await db.update(db.schema.palaceAnchors)
      .set({
        fsrsStability: next.stability,
        fsrsDifficulty: next.difficulty,
        fsrsState: next.state,
        fsrsDue: next.due,
        fsrsElapsedDays: next.elapsedDays,
        fsrsScheduledDays: next.scheduledDays,
        fsrsReps: next.reps,
        fsrsLapses: next.lapses,
        fsrsLastReview: next.lastReview,
        updatedAt: new Date(),
      } as any)
      .where(eq(db.schema.palaceAnchors.id, id));

    return c.json({
      id,
      rating,
      nextDue: next.due,
      scheduledDays: next.scheduledDays,
      stability: next.stability,
      state: next.state,
      requestId,
    });
  } catch (e: any) {
    console.error("[anchors.review.fail]", JSON.stringify({ requestId, msg: String(e?.message ?? "").slice(0, 200) }));
    return c.json({ error: "review_failed", reason: "internal", detail: String(e?.message ?? "").slice(0, 200), requestId }, 500);
  }
});

// ════════════════════════════════════════════════════════════════
// POST /api/anchors — Create anchor from a locus
// ════════════════════════════════════════════════════════════════
anchors.post("/", authMiddleware, zValidator("json", createAnchorSchema), async (c) => {
  const requestId = crypto.randomUUID();
  const internalUserId = c.get("internalUserId");
  const body = c.req.valid("json");
  const db = c.get("db");

  try {
    const anchorId = crypto.randomUUID();

    await db.insert(db.schema.palaceAnchors).values({
      id: anchorId,
      userId: internalUserId,
      palaceId: body.palaceId,
      locusIndex: body.locusIndex,
      concept: body.concept,
      sourceVideoId: body.sourceVideoId || null,
      sourceTimestamp: body.sourceTimestamp || null,
      thumbnailKey: body.thumbnailKey || null,
      fsrsDue: Date.now(), // due immediately
      createdAt: new Date(),
      updatedAt: new Date(),
    } as any);

    return c.json({ id: anchorId, ...body, requestId }, 201);
  } catch (e: any) {
    console.error("[anchors.create.fail]", JSON.stringify({ requestId, msg: String(e?.message ?? "").slice(0, 200) }));
    return c.json({ error: "save_failed", reason: "internal", detail: String(e?.message ?? "").slice(0, 200), requestId }, 500);
  }
});

// ════════════════════════════════════════════════════════════════
// GET /api/anchors — List anchors for a palace
// ════════════════════════════════════════════════════════════════
anchors.get("/", authMiddleware, async (c) => {
  const internalUserId = c.get("internalUserId");
  const db = c.get("db");
  const palaceId = c.req.query("palaceId");

  if (!palaceId) {
    return c.json({ error: "missing palaceId query parameter" }, 400);
  }

  const results = await db.select()
    .from(db.schema.palaceAnchors)
    .where(and(
      eq(db.schema.palaceAnchors.userId, internalUserId),
      eq(db.schema.palaceAnchors.palaceId, palaceId)
    ))
    .orderBy(sql`locus_index ASC`)
    .limit(200);

  return c.json({ data: results });
});

// ════════════════════════════════════════════════════════════════
// DELETE /api/anchors/:id — Remove an anchor
// ════════════════════════════════════════════════════════════════
anchors.delete("/:id", authMiddleware, async (c) => {
  const internalUserId = c.get("internalUserId");
  const id = c.req.param("id") as string;
  const db = c.get("db");

  const anchor = await db.query.palaceAnchors.findFirst({
    where: (a: any, { eq }: any) => eq(a.id, id),
  });
  if (!anchor) return c.json({ error: "not_found" }, 404);
  if (anchor.userId !== internalUserId) return c.json({ error: "forbidden" }, 403);

  await db.delete(db.schema.palaceAnchors).where(eq(db.schema.palaceAnchors.id, id));
  return c.json({ success: true });
});

export default anchors;
