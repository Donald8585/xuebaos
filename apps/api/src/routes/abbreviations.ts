import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { eq, and } from "drizzle-orm";
import type { Env } from "../index";
import { authMiddleware } from "../middleware/auth";
import { TABLES } from "../db/schema";

const abbreviations = new Hono<{ Bindings: Env; Variables: Record<string, any> }>();

const abbrSchema = z.object({
  original: z.string().min(1),
  abbreviation: z.string().min(1),
  step: z.number().int().min(0),
  rule: z.string().optional(),
});

const createSchema = z.object({ palaceId: z.string().min(1), chain: z.array(abbrSchema) });

abbreviations.post("/", authMiddleware, zValidator("json", createSchema), async (c) => {
  const internalUserId = c.get("internalUserId");
  const { palaceId, chain } = c.req.valid("json");
  const db = c.get("db");

  try {
    const palace = await db.query.memoryPalaces.findFirst({ where: (p: any, { eq }: any) => eq(p.id, palaceId) });
    if (!palace) return c.json({ error: "not_found" }, 404);
    if (palace.userId !== internalUserId) return c.json({ error: "forbidden" }, 403);

    const extras = (palace.extras || {}) as any;
    extras.abbreviationChain = chain;

    await db.update(TABLES.memoryPalaces)
      .set({ extras, updatedAt: new Date() } as any)
      .where(eq(TABLES.memoryPalaces.id, palaceId));

    return c.json({ count: chain.length }, 201);
  } catch (e: any) {
    return c.json({ error: "save_failed", detail: String(e?.message ?? "").slice(0, 200) }, 500);
  }
});

abbreviations.get("/palace/:palaceId", authMiddleware, async (c) => {
  const { palaceId } = c.req.param() as any;
  const internalUserId = c.get("internalUserId");
  const db = c.get("db");
  const palace = await db.query.memoryPalaces.findFirst({ where: (p: any, { eq }: any) => eq(p.id, palaceId) });
  if (!palace) return c.json({ error: "not_found" }, 404);
  if (!palace.isPublic && palace.userId !== internalUserId) return c.json({ error: "forbidden" }, 403);

  const extras = (palace.extras || {}) as any;
  return c.json({ chain: extras.abbreviationChain || [] });
});

export default abbreviations;
