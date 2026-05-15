import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { eq, desc, and } from "drizzle-orm";
import type { Env } from "../index";
import { authMiddleware } from "../middleware/auth";
import { TABLES } from "../db/schema";

const walkthroughs = new Hono<{ Bindings: Env; Variables: Record<string, any> }>();

// ── Schemas ──────────────────────────────────────────────────────
const startSchema = z.object({
  palaceId: z.string().min(1),
});

const eventSchema = z.object({
  locusIndex: z.number().int().min(0),
  action: z.enum(["visited", "recalled", "forgot", "skipped"]),
  ts: z.number().int().min(0), // ms from start
});

const finishSchema = z.object({
  durationMs: z.number().int().min(0),
  transcript: z.array(eventSchema).optional(),
  audioKey: z.string().optional(),
});

// ════════════════════════════════════════════════════════════════
// POST /api/walkthroughs — Start a walkthrough session
// ════════════════════════════════════════════════════════════════
walkthroughs.post("/", authMiddleware, zValidator("json", startSchema), async (c) => {
  const requestId = crypto.randomUUID();
  const internalUserId = c.get("internalUserId");
  const { palaceId } = c.req.valid("json");
  const db = c.get("db");

  console.log("[stage.walkthrough.start]", JSON.stringify({ requestId, palaceId }));

  try {
    const palace = await db.query.memoryPalaces.findFirst({
      where: (p: any, { eq }: any) => eq(p.id, palaceId),
    });
    if (!palace) return c.json({ error: "save_failed", reason: "palace_not_found", stage: "handler", requestId }, 404);
    if (palace.userId !== internalUserId) return c.json({ error: "save_failed", reason: "forbidden", stage: "handler", requestId }, 403);

    const id = crypto.randomUUID();
    await db.insert(TABLES.walkthroughs).values({
      id,
      palaceId,
      userId: internalUserId,
      transcript: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    } as any);

    return c.json({ id, palaceId, status: "started", requestId }, 201);
  } catch (e: any) {
    console.error("[walkthroughs.start.fail]", JSON.stringify({ requestId, msg: String(e?.message ?? "").slice(0, 200) }));
    return c.json({ error: "save_failed", reason: "db_error", stage: "handler", detail: String(e?.message ?? "").slice(0, 200), requestId }, 500);
  }
});

// ════════════════════════════════════════════════════════════════
// POST /api/walkthroughs/:id/event — Record a locus interaction
// ════════════════════════════════════════════════════════════════
walkthroughs.post("/:id/event", authMiddleware, zValidator("json", eventSchema), async (c) => {
  const requestId = crypto.randomUUID();
  const internalUserId = c.get("internalUserId");
  const walkthroughId = c.req.param("id");
  const event = c.req.valid("json");
  const db = c.get("db");

  console.log("[stage.walkthrough.event]", JSON.stringify({ requestId, walkthroughId, action: event.action, locusIndex: event.locusIndex }));

  try {
    const wt = await db.query.walkthroughs.findFirst({
      where: (w: any, { eq }: any) => eq(w.id, walkthroughId),
    });
    if (!wt) return c.json({ error: "save_failed", reason: "not_found", stage: "handler", requestId }, 404);
    if (wt.userId !== internalUserId) return c.json({ error: "save_failed", reason: "forbidden", stage: "handler", requestId }, 403);

    const current = (wt.transcript || []) as Array<{ locusIndex: number; action: string; ts: number }>;
    current.push(event);

    const lociVisited = new Set(current.map(e => e.locusIndex)).size;
    const lociCorrect = current.filter(e => e.action === "recalled").length;

    await db.update(TABLES.walkthroughs)
      .set({ transcript: current, lociVisited, lociCorrect, updatedAt: new Date() } as any)
      .where(eq(TABLES.walkthroughs.id, walkthroughId));

    return c.json({ status: "ok", count: current.length, requestId }, 200);
  } catch (e: any) {
    console.error("[walkthroughs.event.fail]", JSON.stringify({ requestId, msg: String(e?.message ?? "").slice(0, 200) }));
    return c.json({ error: "save_failed", reason: "db_error", stage: "handler", detail: String(e?.message ?? "").slice(0, 200), requestId }, 500);
  }
});

// ════════════════════════════════════════════════════════════════
// POST /api/walkthroughs/:id/finish — End session + compute score
// ════════════════════════════════════════════════════════════════
walkthroughs.post("/:id/finish", authMiddleware, zValidator("json", finishSchema), async (c) => {
  const requestId = crypto.randomUUID();
  const internalUserId = c.get("internalUserId");
  const walkthroughId = c.req.param("id");
  const { durationMs, transcript, audioKey } = c.req.valid("json");
  const db = c.get("db");

  console.log("[stage.walkthrough.finish]", JSON.stringify({ requestId, walkthroughId, durationMs, eventCount: transcript?.length }));

  try {
    const wt = await db.query.walkthroughs.findFirst({
      where: (w: any, { eq }: any) => eq(w.id, walkthroughId),
    });
    if (!wt) return c.json({ error: "save_failed", reason: "not_found", stage: "handler", requestId }, 404);
    if (wt.userId !== internalUserId) return c.json({ error: "save_failed", reason: "forbidden", stage: "handler", requestId }, 403);

    const finalTranscript = transcript || (wt.transcript || []);
    const visitedCount = new Set(finalTranscript.map((e: any) => e.locusIndex)).size;
    const correctCount = finalTranscript.filter((e: any) => e.action === "recalled").length;
    const totalCount = finalTranscript.filter((e: any) => e.action !== "skipped").length;
    const recallScore = totalCount > 0 ? Math.round((correctCount / totalCount) * 100) : 0;

    await db.update(TABLES.walkthroughs)
      .set({
        durationMs,
        transcript: finalTranscript,
        audioKey: audioKey || wt.audioKey,
        lociVisited: visitedCount,
        lociCorrect: correctCount,
        recallScore,
        updatedAt: new Date(),
      } as any)
      .where(eq(TABLES.walkthroughs.id, walkthroughId));

    return c.json({
      id: walkthroughId,
      durationMs,
      recallScore,
      lociVisited: visitedCount,
      lociCorrect: correctCount,
      transcript: finalTranscript,
      requestId,
    }, 200);
  } catch (e: any) {
    console.error("[walkthroughs.finish.fail]", JSON.stringify({ requestId, msg: String(e?.message ?? "").slice(0, 200) }));
    return c.json({ error: "save_failed", reason: "db_error", stage: "handler", detail: String(e?.message ?? "").slice(0, 200), requestId }, 500);
  }
});

// ════════════════════════════════════════════════════════════════
// GET /api/walkthroughs/:id — Get walkthrough with timeline
// ════════════════════════════════════════════════════════════════
walkthroughs.get("/:id", authMiddleware, async (c) => {
  const id = c.req.param("id");
  const db = c.get("db");
  const internalUserId = c.get("internalUserId");

  const wt = await db.query.walkthroughs.findFirst({
    where: (w: any, { eq }: any) => eq(w.id, id),
  });
  if (!wt) return c.json({ error: "not_found" }, 404);
  if (wt.userId !== internalUserId) return c.json({ error: "forbidden" }, 403);

  return c.json(wt);
});

// ════════════════════════════════════════════════════════════════
// GET /api/walkthroughs — List user's walkthroughs
// ════════════════════════════════════════════════════════════════
walkthroughs.get("/", authMiddleware, async (c) => {
  const internalUserId = c.get("internalUserId");
  const db = c.get("db");
  const palaceId = c.req.query("palaceId");

  const conditions = [eq(TABLES.walkthroughs.userId, internalUserId)];
  if (palaceId) conditions.push(eq(TABLES.walkthroughs.palaceId, palaceId));

  const results = await db.select()
    .from(TABLES.walkthroughs)
    .where(and(...conditions))
    .orderBy(desc(TABLES.walkthroughs.createdAt))
    .limit(50);

  return c.json({ data: results });
});

export default walkthroughs;
