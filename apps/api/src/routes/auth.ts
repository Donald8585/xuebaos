import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { eq } from "drizzle-orm";
import type { Env } from "../index";
import { authMiddleware } from "../middleware/auth";

const auth = new Hono<{ Bindings: Env; Variables: Record<string, any> }>();

// GET /api/auth/me — Current user info
auth.get("/me", authMiddleware, async (c) => {
  const internalUserId = c.get("internalUserId");

  const db = c.get("db");
  const user = await db.query.users.findFirst({
    where: (u, { eq }) => eq(u.id, internalUserId),
  });

  if (!user) {
    return c.json({ error: "User not found" }, 404);
  }

  return c.json({
    id: user.id,
    clerkId: user.clerkId,
    email: user.email,
    username: user.username,
    avatarUrl: user.avatarUrl,
    subscriptionTier: user.subscriptionTier,
    subscriptionEnds: user.subscriptionEnds,
    createdAt: user.createdAt,
  });
});

// PUT /api/auth/me — Update user profile
const updateProfileSchema = z.object({
  username: z.string().min(1).max(50).optional(),
  avatarUrl: z.string().url().optional(),
});

auth.put("/me", authMiddleware, zValidator("json", updateProfileSchema), async (c) => {
  const internalUserId = c.get("internalUserId");
  const body = c.req.valid("json");
  const db = c.get("db");

  const updates: Record<string, unknown> = { updatedAt: new Date() };
  if (body.username) updates.username = body.username;
  if (body.avatarUrl) updates.avatarUrl = body.avatarUrl;

  await db.update(db.schema.users)
    .set(updates)
    .where(eq(db.schema.users.id, internalUserId));

  return c.json({ success: true });
});

export default auth;
