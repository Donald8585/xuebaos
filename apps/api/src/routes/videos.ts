import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { eq, desc, and, sql } from "drizzle-orm";
import type { Env } from "../index";
import { authMiddleware } from "../middleware/auth";
import { storeSceneThumbnail, deleteVideoAssets } from "../services/video";

const videos = new Hono<{ Bindings: Env; Variables: Record<string, any> }>();

const MAX_VIDEO_BYTES = 200 * 1024 * 1024; // 200 MB

// ════════════════════════════════════════════════════════════════
// POST /api/videos — Upload video to R2 + create DB record
// ════════════════════════════════════════════════════════════════
videos.post("/", authMiddleware, async (c) => {
  const requestId = crypto.randomUUID();
  const internalUserId = c.get("internalUserId");
  const db = c.get("db");

  try {
    const formData = await c.req.formData();
    const file = formData.get("file");
    const title = formData.get("title")?.toString() || "Untitled Video";
    const palaceId = formData.get("palaceId")?.toString() || null;

    if (!file || !(file instanceof File)) {
      return c.json({ error: "validation_failed", reason: "missing_file", requestId }, 400);
    }

    // Validate type
    const validTypes = ["video/mp4", "video/webm", "video/quicktime", "video/x-msvideo"];
    const extMatch = file.name.match(/\.(mp4|webm|mov|avi)$/i);
    if (!validTypes.includes(file.type) && !extMatch) {
      return c.json({ error: "unsupported_format", supported: ["mp4", "webm", "mov", "avi"], requestId }, 400);
    }

    if (file.size > MAX_VIDEO_BYTES) {
      return c.json({ error: "file_too_large", maxBytes: MAX_VIDEO_BYTES, actualBytes: file.size, requestId }, 413);
    }

    // Upload to R2
    const r2Key = `users/${internalUserId}/videos/${Date.now()}-${encodeURIComponent(file.name)}`;
    const buffer = await file.arrayBuffer();
    await c.env.STORAGE.put(r2Key, buffer, {
      httpMetadata: { contentType: file.type || "video/mp4" },
    });

    // Create DB record
    const videoId = crypto.randomUUID();
    await db.insert(db.schema.palaceVideos).values({
      id: videoId,
      userId: internalUserId,
      palaceId,
      title,
      fileName: file.name,
      fileSize: file.size,
      r2Key,
      status: "ready",
      scenes: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    } as any);

    return c.json({
      id: videoId,
      key: r2Key,
      publicUrl: `/api/storage/${r2Key}`,
      fileName: file.name,
      fileSize: file.size,
      status: "ready",
      requestId,
    }, 201);
  } catch (e: any) {
    console.error("[videos.upload.fail]", JSON.stringify({ requestId, msg: String(e?.message ?? "").slice(0, 200) }));
    return c.json({ error: "upload_failed", reason: "internal", detail: String(e?.message ?? "").slice(0, 200), requestId }, 500);
  }
});

// ════════════════════════════════════════════════════════════════
// GET /api/videos — List user's videos
// ════════════════════════════════════════════════════════════════
videos.get("/", authMiddleware, async (c) => {
  const internalUserId = c.get("internalUserId");
  const db = c.get("db");
  const palaceId = c.req.query("palaceId");

  const conditions = [eq(db.schema.palaceVideos.userId, internalUserId)];
  if (palaceId) conditions.push(eq(db.schema.palaceVideos.palaceId, palaceId));

  const results = await db.select()
    .from(db.schema.palaceVideos)
    .where(and(...conditions))
    .orderBy(desc(db.schema.palaceVideos.createdAt))
    .limit(50);

  return c.json({ data: results });
});

// ════════════════════════════════════════════════════════════════
// GET /api/videos/:id — Get single video
// ════════════════════════════════════════════════════════════════
videos.get("/:id", authMiddleware, async (c) => {
  const id = c.req.param("id") as string;
  const internalUserId = c.get("internalUserId");
  const db = c.get("db");

  const video = await db.query.palaceVideos.findFirst({
    where: (v: any, { eq }: any) => eq(v.id, id),
  });

  if (!video) return c.json({ error: "not_found" }, 404);
  if (video.userId !== internalUserId) return c.json({ error: "forbidden" }, 403);

  return c.json(video);
});

// ════════════════════════════════════════════════════════════════
// POST /api/videos/:id/scenes — Store scene metadata
// ════════════════════════════════════════════════════════════════
const scenesSchema = z.object({
  scenes: z.array(z.object({
    timestampSeconds: z.number().min(0),
    label: z.string().optional(),
  })),
});

videos.post("/:id/scenes", authMiddleware, zValidator("json", scenesSchema), async (c) => {
  const requestId = crypto.randomUUID();
  const internalUserId = c.get("internalUserId");
  const id = c.req.param("id") as string;
  const { scenes } = c.req.valid("json");
  const db = c.get("db");

  try {
    const video = await db.query.palaceVideos.findFirst({
      where: (v: any, { eq }: any) => eq(v.id, id),
    });
    if (!video) return c.json({ error: "not_found" }, 404);
    if (video.userId !== internalUserId) return c.json({ error: "forbidden" }, 403);

    const sceneRecords = scenes.map((s, i) => ({
      timestampSeconds: s.timestampSeconds,
      label: s.label || `Scene ${i + 1}`,
    }));

    await db.update(db.schema.palaceVideos)
      .set({
        scenes: sceneRecords,
        sceneCount: sceneRecords.length,
        updatedAt: new Date(),
      } as any)
      .where(eq(db.schema.palaceVideos.id, id));

    return c.json({ id, sceneCount: sceneRecords.length, scenes: sceneRecords, requestId });
  } catch (e: any) {
    console.error("[videos.scenes.fail]", JSON.stringify({ requestId, msg: String(e?.message ?? "").slice(0, 200) }));
    return c.json({ error: "save_failed", reason: "internal", detail: String(e?.message ?? "").slice(0, 200), requestId }, 500);
  }
});

// ════════════════════════════════════════════════════════════════
// POST /api/videos/:id/thumbnail — Upload scene thumbnail
// ════════════════════════════════════════════════════════════════
const thumbnailSchema = z.object({
  timestampSeconds: z.number().min(0),
  base64Data: z.string(),
});

videos.post("/:id/thumbnail", authMiddleware, zValidator("json", thumbnailSchema), async (c) => {
  const requestId = crypto.randomUUID();
  const internalUserId = c.get("internalUserId");
  const id = c.req.param("id") as string;
  const { timestampSeconds, base64Data } = c.req.valid("json");
  const db = c.get("db");

  try {
    const video = await db.query.palaceVideos.findFirst({
      where: (v: any, { eq }: any) => eq(v.id, id),
    });
    if (!video) return c.json({ error: "not_found" }, 404);
    if (video.userId !== internalUserId) return c.json({ error: "forbidden" }, 403);

    const { key } = await storeSceneThumbnail(c.env, id, timestampSeconds, base64Data);

    // Update scene record with thumbnail key
    const currentScenes = (video.scenes || []) as any[];
    const updatedScenes = currentScenes.map((s: any) =>
      Math.abs(s.timestampSeconds - timestampSeconds) < 0.1
        ? { ...s, thumbnailKey: key }
        : s
    );

    await db.update(db.schema.palaceVideos)
      .set({ scenes: updatedScenes, updatedAt: new Date() } as any)
      .where(eq(db.schema.palaceVideos.id, id));

    return c.json({ key, timestampSeconds, requestId });
  } catch (e: any) {
    console.error("[videos.thumbnail.fail]", JSON.stringify({ requestId, msg: String(e?.message ?? "").slice(0, 200) }));
    return c.json({ error: "save_failed", reason: "internal", detail: String(e?.message ?? "").slice(0, 200), requestId }, 500);
  }
});

// ════════════════════════════════════════════════════════════════
// DELETE /api/videos/:id — Delete video + assets
// ════════════════════════════════════════════════════════════════
videos.delete("/:id", authMiddleware, async (c) => {
  const requestId = crypto.randomUUID();
  const internalUserId = c.get("internalUserId");
  const id = c.req.param("id") as string;
  const db = c.get("db");

  try {
    const video = await db.query.palaceVideos.findFirst({
      where: (v: any, { eq }: any) => eq(v.id, id),
    });
    if (!video) return c.json({ error: "not_found" }, 404);
    if (video.userId !== internalUserId) return c.json({ error: "forbidden" }, 403);

    await deleteVideoAssets(c.env, id, video.r2Key as string);
    await db.delete(db.schema.palaceVideos).where(eq(db.schema.palaceVideos.id, id));

    return c.json({ success: true, requestId });
  } catch (e: any) {
    console.error("[videos.delete.fail]", JSON.stringify({ requestId, msg: String(e?.message ?? "").slice(0, 200) }));
    return c.json({ error: "delete_failed", reason: "internal", requestId }, 500);
  }
});

export default videos;
