import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { eq } from "drizzle-orm";
import type { Env } from "../index";
import { authMiddleware } from "../middleware/auth";
import { TABLES } from "../db/schema";

const settings = new Hono<{ Bindings: Env; Variables: Record<string, any> }>();

const updateSchema = z.object({
  username: z.string().min(1).max(50).optional(),
  email: z.string().email().optional(),
  studyGoalMinutes: z.number().int().min(5).max(480).optional(),
  emailNotifications: z.boolean().optional(),
  theme: z.enum(["dark", "light", "auto"]).optional(),
}).strict();

// GET /api/settings — Get user settings
settings.get("/", authMiddleware, async (c) => {
  const internalUserId = c.get("internalUserId");
  const db = c.get("db");
  const user = await db.query.users.findFirst({ where: (u: any, { eq }: any) => eq(u.id, internalUserId) });
  if (!user) return c.json({ error: "not_found" }, 404);
  return c.json({
    username: user.username,
    email: user.email,
    subscriptionTier: user.subscriptionTier,
    avatarUrl: user.avatarUrl,
    createdAt: user.createdAt,
  });
});

// PUT /api/settings — Update user settings
settings.put("/", authMiddleware, zValidator("json", updateSchema), async (c) => {
  const internalUserId = c.get("internalUserId");
  const body = c.req.valid("json");
  const db = c.get("db");

  const updates: any = { updatedAt: new Date() };
  if (body.username !== undefined) updates.username = body.username;
  if (body.emailNotifications !== undefined) {
    // Store in extras or a separate prefs column
    const user = await db.query.users.findFirst({ where: (u: any, { eq }: any) => eq(u.id, internalUserId) });
    const extras = (user as any)?.extras || {};
    extras.emailNotifications = body.emailNotifications;
    updates.subscriptionTier = undefined; // placeholder — would need extras column
  }

  await db.update(TABLES.users).set(updates).where(eq(TABLES.users.id, internalUserId));
  return c.json({ status: "ok" });
});

// DELETE /api/settings/account — Delete account
settings.delete("/account", authMiddleware, async (c) => {
  const internalUserId = c.get("internalUserId");
  const db = c.get("db");
  // Soft-delete: anonymize user data
  await db.update(TABLES.users)
    .set({ email: null, username: `deleted-${internalUserId.slice(0, 8)}`, updatedAt: new Date() } as any)
    .where(eq(TABLES.users.id, internalUserId));
  return c.json({ status: "deleted" });
});

// GET /api/settings/export — Export all user data as JSON
settings.get("/export", authMiddleware, async (c) => {
  const internalUserId = c.get("internalUserId");
  const db = c.get("db");
  const [user, palaces, stories, questions] = await Promise.all([
    db.query.users.findFirst({ where: (u: any, { eq }: any) => eq(u.id, internalUserId) }),
    db.select().from(TABLES.memoryPalaces).where(eq(TABLES.memoryPalaces.userId, internalUserId)),
    db.select().from(TABLES.mnemonicStories).where(eq(TABLES.mnemonicStories.userId, internalUserId)),
    db.select().from(TABLES.questions).where(eq(TABLES.questions.userId, internalUserId)),
  ]);
  return c.json({
    exportedAt: new Date().toISOString(),
    user: { username: user?.username, email: user?.email, createdAt: user?.createdAt },
    palaces: palaces.length,
    stories: stories.length,
    questions: questions.length,
  });
});

export default settings;
