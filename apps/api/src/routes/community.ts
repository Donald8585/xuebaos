import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { eq, desc } from "drizzle-orm";
import type { Env } from "../index";
import { authMiddleware } from "../middleware/auth";
import { TABLES } from "../db/schema";

const social = new Hono<{ Bindings: Env; Variables: Record<string, any> }>();

// ── Public Palace Feed ──────────────────────────────────────────

// GET /api/community — Public feed of recent shared palaces
social.get("/", async (c) => {
  const db = c.get("db");
  const page = Number(c.req.query("page") || "1");
  const limit = Math.min(Number(c.req.query("limit") || "12"), 50);

  try {
    const results = await db.select()
      .from(TABLES.memoryPalaces)
      .where(eq(TABLES.memoryPalaces.isPublic, true))
      .orderBy(desc(TABLES.memoryPalaces.updatedAt))
      .limit(limit)
      .offset((page - 1) * limit);

    const countResult = await db.select({ count: db._.sql<number>`count(*)` })
      .from(TABLES.memoryPalaces)
      .where(eq(TABLES.memoryPalaces.isPublic, true));

    const feed = (results as any[]).map(p => ({
      id: p.id,
      name: p.name,
      slug: p.slug,
      description: p.description?.slice(0, 200),
      subject: p.subject,
      lociCount: p.lociCount,
      createdAt: p.createdAt,
    }));

    return c.json({ data: feed, total: countResult[0]?.count ?? 0, page, limit });
  } catch (e: any) {
    return c.json({ error: "internal_error", detail: String(e?.message ?? "").slice(0, 200) }, 500);
  }
});

// GET /p/:slug — Public read-only walkthrough (no auth required)
social.get("/p/:slug", async (c) => {
  const { slug } = c.req.param() as any;
  const db = c.get("db");

  try {
    const palace = await db.query.memoryPalaces.findFirst({
      where: (p: any, { eq, and }: any) => and(eq(p.slug, slug), eq(p.isPublic, true)),
    });
    if (!palace) return c.json({ error: "not_found" }, 404);

    return c.json({
      id: palace.id,
      name: palace.name,
      description: palace.description,
      subject: palace.subject,
      loci: palace.loci,
      lociCount: palace.lociCount,
      spatialMap: palace.spatialMap || [],
    });
  } catch (e: any) {
    return c.json({ error: "internal_error" }, 500);
  }
});

// POST /api/palaces/:id/share — Toggle public sharing
social.post("/share/:id", authMiddleware, async (c) => {
  const internalUserId = c.get("internalUserId");
  const palaceId = c.req.param("id")!;
  const db = c.get("db");

  try {
    const palace = await db.query.memoryPalaces.findFirst({ where: (p: any, { eq }: any) => eq(p.id, palaceId) });
    if (!palace) return c.json({ error: "not_found" }, 404);
    if (palace.userId !== internalUserId) return c.json({ error: "forbidden" }, 403);

    const newPublic = !palace.isPublic;
    await db.update(TABLES.memoryPalaces)
      .set({ isPublic: newPublic, updatedAt: new Date() } as any)
      .where(eq(TABLES.memoryPalaces.id, palaceId));

    return c.json({
      isPublic: newPublic,
      shareUrl: newPublic ? `/p/${palace.slug}` : null,
    });
  } catch (e: any) {
    return c.json({ error: "save_failed", detail: String(e?.message ?? "").slice(0, 200) }, 500);
  }
});

export default social;
