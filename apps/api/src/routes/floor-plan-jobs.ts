import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { eq } from "drizzle-orm";
import type { Env } from "../index";
import { authMiddleware } from "../middleware/auth";

const floorPlanJobs = new Hono<{ Bindings: Env; Variables: Record<string, any> }>();

const MAX_VIDEO_BYTES = 200 * 1024 * 1024; // 200MB
const MAX_FRAMES = 8;

const createSchema = z.object({
  frames: z.array(z.string()).min(1).max(MAX_FRAMES),
  palaceId: z.string().optional(),
  sourceVideoId: z.string().optional(),
});

// ════════════════════════════════════════════════════════════════
// POST /api/floor-plan-jobs — Submit frames, extract floor plan
// ════════════════════════════════════════════════════════════════
floorPlanJobs.post("/", authMiddleware, zValidator("json", createSchema), async (c) => {
  const requestId = crypto.randomUUID();
  const internalUserId = c.get("internalUserId");
  const db = c.get("db");
  const body = c.req.valid("json");

  try {
    // ── Validate frames ───────────────────────────────────────────
    const validFrames = body.frames.filter(f =>
      f.startsWith("data:image/") && f.length < 5 * 1024 * 1024
    );
    if (validFrames.length === 0) {
      return c.json({ error: "no_valid_frames", code: "INVALID_FRAMES", requestId }, 400);
    }

    // ── Create job ─────────────────────────────────────────────────
    const jobId = crypto.randomUUID();
    await db.insert(db.schema.floorPlans).values({
      id: jobId,
      userId: internalUserId,
      palaceId: body.palaceId || null,
      sourceVideoId: body.sourceVideoId || null,
      status: "extracting",
      roomCount: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    } as any);

    // ── Extract floor plan in background ───────────────────────────
    c.executionCtx.waitUntil((async () => {
      try {
        const { extractFloorPlan } = await import("../services/floor-plan-extractor");
        const schema = await extractFloorPlan(c.env, validFrames);

        const roomCount = schema.rooms?.length || 0;
        await db.update(db.schema.floorPlans)
          .set({
            status: "ready",
            roomSchema: JSON.stringify(schema),
            roomCount,
            updatedAt: new Date(),
          } as any)
          .where(eq(db.schema.floorPlans.id, jobId));

        // If linked to a palace, update its spatial map
        if (body.palaceId && roomCount > 0) {
          const spatialMapNodes = schema.rooms.map((room, i) => ({
            id: `room-${i}`,
            name: room.name,
            x: 0,  // Client positions rooms
            y: 0,
            width: Math.round(room.width_m * 100),
            height: Math.round(room.height_m * 100),
            connections: room.connections,
            metadata: {
              floor_type: room.floor_type,
              notable_features: room.notable_features,
              dimensions_m: { width: room.width_m, height: room.height_m },
            },
          }));

          await db.update(db.schema.memoryPalaces)
            .set({ spatialMap: spatialMapNodes, updatedAt: new Date() } as any)
            .where(eq(db.schema.memoryPalaces.id, body.palaceId));
        }

        console.log(`[floor-plan] Job ${jobId}: ${roomCount} rooms detected`);
      } catch (e: any) {
        console.error(`[floor-plan.fail] Job ${jobId}:`, String(e?.message ?? "").slice(0, 300));
        await db.update(db.schema.floorPlans)
          .set({
            status: "failed",
            error: String(e?.message ?? "").slice(0, 500),
            updatedAt: new Date(),
          } as any)
          .where(eq(db.schema.floorPlans.id, jobId));
      }
    })());

    return c.json({ jobId, status: "extracting", requestId }, 202);

  } catch (e: any) {
    console.error("[floor-plan.create.fail]", JSON.stringify({
      requestId,
      msg: String(e?.message ?? "").slice(0, 300),
    }));
    return c.json({
      error: "job_creation_failed",
      code: "FLOOR_PLAN_CREATE_FAILED",
      detail: String(e?.message ?? "").slice(0, 200),
      requestId,
    }, 500);
  }
});

// ════════════════════════════════════════════════════════════════
// GET /api/floor-plan-jobs/:id — Job status + room schema
// ════════════════════════════════════════════════════════════════
floorPlanJobs.get("/:id", authMiddleware, async (c) => {
  const id = c.req.param("id")!;
  const db = c.get("db");

  const plan = await db.query.floorPlans.findFirst({
    where: (p: any, { eq: any }: any) => eq(p.id, id),
  });

  if (!plan) return c.json({ error: "not_found" }, 404);

  let schema = null;
  if (plan.roomSchema) {
    try { schema = JSON.parse(plan.roomSchema); } catch {}
  }

  return c.json({
    id: plan.id,
    status: plan.status,
    roomCount: plan.roomCount,
    schema,
    error: plan.error,
    createdAt: plan.createdAt,
  });
});

// ════════════════════════════════════════════════════════════════
// GET /api/floor-plan-jobs/:id/stream — SSE progress stream
// ════════════════════════════════════════════════════════════════
floorPlanJobs.get("/:id/stream", authMiddleware, async (c) => {
  const id = c.req.param("id")!;
  const db = c.get("db");

  const plan = await db.query.floorPlans.findFirst({
    where: (p: any, { eq: any }: any) => eq(p.id, id),
  });
  if (!plan) return c.json({ error: "not_found" }, 404);

  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder();
      const send = (data: string) => controller.enqueue(encoder.encode(`data: ${data}\n\n`));

      send(JSON.stringify({ type: "init", status: plan.status }));

      for (let poll = 0; poll < 300; poll++) {
        await new Promise(r => setTimeout(r, 1000));

        try {
          const updated = await db.query.floorPlans.findFirst({
            where: (p: any, { eq: any }: any) => eq(p.id, id),
          });

          if (!updated) {
            send(JSON.stringify({ type: "error", error: "Job not found" }));
            controller.close();
            return;
          }

          if (updated.status === "ready") {
            let schema = null;
            try { schema = JSON.parse(updated.roomSchema || "{}"); } catch {}
            send(JSON.stringify({
              type: "complete",
              roomCount: updated.roomCount,
              schema,
            }));
            controller.close();
            return;
          }

          if (updated.status === "failed") {
            send(JSON.stringify({ type: "error", error: updated.error }));
            controller.close();
            return;
          }
        } catch { /* poll error, retry */ }
      }

      send(JSON.stringify({ type: "error", error: "Stream timeout" }));
      controller.close();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
});

export default floorPlanJobs;
