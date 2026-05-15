import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { eq, desc } from "drizzle-orm";
import type { Env } from "../index";
import { authMiddleware } from "../middleware/auth";
import { TABLES } from "../db/schema";

const conceptChains = new Hono<{ Bindings: Env; Variables: Record<string, any> }>();

const createSchema = z.object({
  rootConcept: z.string().min(1),
  chainJson: z.object({
    nodes: z.array(z.object({ id: z.string(), label: z.string(), level: z.number() })).optional(),
    edges: z.array(z.object({ source: z.string(), target: z.string(), relation: z.string() })).optional(),
  }).optional(),
});

conceptChains.post("/", authMiddleware, zValidator("json", createSchema), async (c) => {
  const internalUserId = c.get("internalUserId");
  const { rootConcept, chainJson } = c.req.valid("json");
  const db = c.get("db");
  const id = crypto.randomUUID();
  const now = new Date();

  await db.insert(TABLES.conceptChains).values({ id, userId: internalUserId, rootConcept, chainJson: chainJson || {}, createdAt: now, updatedAt: now } as any);
  return c.json({ id, rootConcept }, 201);
});

conceptChains.get("/", authMiddleware, async (c) => {
  const internalUserId = c.get("internalUserId");
  const db = c.get("db");
  const results = await db.select().from(TABLES.conceptChains)
    .where(eq(TABLES.conceptChains.userId, internalUserId))
    .orderBy(desc(TABLES.conceptChains.updatedAt))
    .limit(50);
  return c.json({ data: results });
});

conceptChains.put("/:id", authMiddleware, zValidator("json", createSchema.partial()), async (c) => {
  const internalUserId = c.get("internalUserId");
  const id = c.req.param("id")!;
  const db = c.get("db");
  const existing = await db.query.conceptChains.findFirst({ where: (cc: any, { eq }: any) => eq(cc.id, id) });
  if (!existing) return c.json({ error: "not_found" }, 404);
  if (existing.userId !== internalUserId) return c.json({ error: "forbidden" }, 403);

  const updates: any = { updatedAt: new Date() };
  if (c.req.valid("json").chainJson) updates.chainJson = c.req.valid("json").chainJson;

  await db.update(TABLES.conceptChains).set(updates).where(eq(TABLES.conceptChains.id, id));
  return c.json({ status: "ok" });
});

conceptChains.delete("/:id", authMiddleware, async (c) => {
  const internalUserId = c.get("internalUserId");
  const id = c.req.param("id")!;
  const db = c.get("db");
  const existing = await db.query.conceptChains.findFirst({ where: (cc: any, { eq }: any) => eq(cc.id, id) });
  if (!existing) return c.json({ error: "not_found" }, 404);
  if (existing.userId !== internalUserId) return c.json({ error: "forbidden" }, 403);

  await db.delete(TABLES.conceptChains).where(eq(TABLES.conceptChains.id, id));
  return c.json({ success: true });
});

export default conceptChains;
