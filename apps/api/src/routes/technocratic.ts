import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { eq, desc, and, sql, gte } from "drizzle-orm";
import type { Env } from "../index";
import { authMiddleware } from "../middleware/auth";

const technocratic = new Hono<{ Bindings: Env; Variables: Record<string, any> }>();

const DEFAULT_PAGE_SIZE = 20;

// ── Audit Schemas ────────────────────────────────────────────
const createAuditSchema = z.object({
  auditType: z.enum(["study_efficiency", "memory_retention", "time_allocation"]),
  periodStart: z.string().datetime().optional(),
  periodEnd: z.string().datetime().optional(),
  metrics: z.record(z.string(), z.number()).optional(),
  findings: z.string().optional(),
  recommendations: z.string().optional(),
  score: z.number().min(0).max(100).optional(),
});

const auditPaginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(DEFAULT_PAGE_SIZE),
  auditType: z.enum(["study_efficiency", "memory_retention", "time_allocation"]).optional(),
});

// ── Method Schemas ──────────────────────────────────────────
const createMethodSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().optional(),
  category: z.enum(["memorization", "recall", "focus", "reading"]),
  steps: z.array(z.string()).optional(),
  effectiveness: z.number().min(0).max(10).optional(),
  isCustom: z.boolean().default(false),
});

const updateMethodSchema = createMethodSchema.partial();

const methodPaginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(DEFAULT_PAGE_SIZE),
  category: z.enum(["memorization", "recall", "focus", "reading"]).optional(),
});

// ════════════════════════════════════════════════════════════════
// Audits
// ════════════════════════════════════════════════════════════════
technocratic.get("/audits", authMiddleware, zValidator("query", auditPaginationSchema), async (c) => {
  const internalUserId = c.get("internalUserId");
  const { page, limit, auditType } = c.req.valid("query");
  const db = c.get("db");
  const offset = (page - 1) * limit;

  const conditions = [eq(db.schema.technocraticAudits.userId, internalUserId)];
  if (auditType) conditions.push(eq(db.schema.technocraticAudits.auditType, auditType));
  const where = and(...conditions);

  const [results, countResult] = await Promise.all([
    db.select().from(db.schema.technocraticAudits).where(where)
      .orderBy(desc(db.schema.technocraticAudits.createdAt)).limit(limit).offset(offset),
    db.select({ count: sql<number>`count(*)` }).from(db.schema.technocraticAudits).where(where),
  ]);

  return c.json({
    data: results,
    pagination: { page, limit, total: countResult[0]?.count ?? 0,
      totalPages: Math.ceil((countResult[0]?.count ?? 0) / limit) },
  });
});

technocratic.get("/audits/:id", authMiddleware, async (c) => {
  const id = c.req.param("id");
  const internalUserId = c.get("internalUserId");
  const db = c.get("db");
  const audit = await db.query.technocraticAudits.findFirst({ where: (a, { eq }) => eq(a.id, id) });
  if (!audit) return c.json({ error: "Not found" }, 404);
  if (audit.userId !== internalUserId) return c.json({ error: "Forbidden" }, 403);
  return c.json(audit);
});

technocratic.post("/audits", authMiddleware, zValidator("json", createAuditSchema), async (c) => {
  const internalUserId = c.get("internalUserId");
  const body = c.req.valid("json");
  const db = c.get("db");
  const id = crypto.randomUUID();
  const now = new Date();

  await db.insert(db.schema.technocraticAudits).values({
    id, userId: internalUserId, auditType: body.auditType,
    periodStart: body.periodStart ? new Date(body.periodStart) : null,
    periodEnd: body.periodEnd ? new Date(body.periodEnd) : null,
    metrics: body.metrics ?? {}, findings: body.findings ?? null,
    recommendations: body.recommendations ?? null,
    score: body.score ?? null,
    createdAt: now, updatedAt: now,
  });

  const created = await db.query.technocraticAudits.findFirst({ where: (a, { eq }) => eq(a.id, id) });
  return c.json(created, 201);
});

// ════════════════════════════════════════════════════════════════
// POST /api/technocratic/run-audit — Run an automated audit
// ════════════════════════════════════════════════════════════════
technocratic.post("/run-audit", authMiddleware, zValidator("json", z.object({
  auditType: z.enum(["study_efficiency", "memory_retention", "time_allocation"]),
  days: z.number().int().min(1).max(365).default(30),
})), async (c) => {
  const internalUserId = c.get("internalUserId");
  const { auditType, days } = c.req.valid("json");
  const db = c.get("db");
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  const now = new Date();

  let metrics: Record<string, number> = {};
  let findings = "";
  let score = 0;
  let recommendations = "";

  if (auditType === "study_efficiency") {
    // Analyze study sessions
    const sessions = await db
      .select()
      .from(db.schema.studySessions)
      .where(
        and(
          eq(db.schema.studySessions.userId, internalUserId),
          gte(db.schema.studySessions.createdAt, since)
        )
      );

    const totalMinutes = sessions.reduce((s, sess) => s + (sess.durationMinutes ?? 0), 0);
    const avgFocus = sessions.length > 0
      ? sessions.reduce((s, sess) => s + (sess.focusScore ?? 0), 0) / sessions.length
      : 0;
    const sessionsPerDay = days > 0 ? sessions.length / days : 0;

    metrics = {
      totalMinutes: Math.round(totalMinutes),
      avgFocus: Math.round(avgFocus),
      sessionCount: sessions.length,
      sessionsPerDay: Math.round(sessionsPerDay * 10) / 10,
    };

    score = Math.min(
      Math.round((avgFocus * 0.4 + Math.min(sessionsPerDay / 3, 1) * 0.6) * 100),
      100
    );

    findings = sessions.length > 0
      ? `Completed ${sessions.length} study sessions totaling ${Math.round(totalMinutes)} minutes over ${days} days.`
      : "No study sessions recorded in this period.";

    recommendations = [
      sessionsPerDay < 1 && "Consider increasing study frequency to at least 1 session per day.",
      avgFocus < 60 && "Focus scores are low — try the Pomodoro technique or reducing distractions.",
      totalMinutes < days * 30 && "Total study time is below recommended levels (30 min/day minimum).",
    ].filter(Boolean).join(" ") || "Keep up the good work!";
  } else if (auditType === "memory_retention") {
    // Analyze FSRS/question data
    const questions = await db
      .select()
      .from(db.schema.questions)
      .where(eq(db.schema.questions.userId, internalUserId));

    const total = questions.length;
    const answered = questions.filter((q) => q.lastAnsweredAt && new Date(q.lastAnsweredAt) >= since).length;
    const correct = questions.filter((q) => q.lastAnswerCorrect === true).length;
    const lapses = questions.reduce((s, q) => s + (q.fsrsLapses ?? 0), 0);
    const avgDiff = total > 0
      ? questions.reduce((s, q) => s + (q.fsrsDifficulty ?? 0.3), 0) / total
      : 0.3;

    metrics = {
      totalQuestions: total,
      answeredPeriod: answered,
      correctCount: correct,
      accuracy: total > 0 ? Math.round((correct / Math.max(answered, 1)) * 100) : 0,
      totalLapses: lapses,
      avgDifficulty: Math.round(avgDiff * 100) / 100,
    };

    score = Math.min(Math.round((metrics.accuracy * 0.6 + (1 - avgDiff) * 0.4) * 100), 100);

    findings = `You have ${total} questions in your bank. ${answered} were reviewed in this period. Accuracy: ${metrics.accuracy}%.`;
    recommendations = [
      lapses > answered * 0.3 && "High lapse rate — consider lowering difficulty or reviewing fundamentals.",
      avgDiff > 0.7 && "Questions may be too difficult — add easier ones or break down complex topics.",
    ].filter(Boolean).join(" ");
  } else if (auditType === "time_allocation") {
    // Analyze study time distribution
    const bySubject = await db
      .select({
        subject: db.schema.studySessions.subject,
        minutes: sql<number>`coalesce(sum(duration_minutes), 0)`,
      })
      .from(db.schema.studySessions)
      .where(
        and(
          eq(db.schema.studySessions.userId, internalUserId),
          gte(db.schema.studySessions.createdAt, since)
        )
      )
      .groupBy(db.schema.studySessions.subject);

    metrics = Object.fromEntries(
      bySubject.map((s) => [s.subject, s.minutes])
    );

    const totalMinutes = Object.values(metrics).reduce((a, b) => a + b, 0);
    metrics.totalMinutes = totalMinutes;

    findings = `Time distributed across ${bySubject.length} subjects. Total: ${Math.round(totalMinutes)} minutes.`;

    // Check balance
    const avgPerSubject = bySubject.length > 0 ? totalMinutes / bySubject.length : 0;
    const imbalanced = bySubject.filter(
      (s) => Math.abs(s.minutes - avgPerSubject) / Math.max(avgPerSubject, 1) > 0.5
    );
    score = imbalanced.length > 0
      ? Math.max(0, 100 - imbalanced.length * 20)
      : 85;

    recommendations = imbalanced.length > 0
      ? `Consider rebalancing time across subjects: ${imbalanced.map((s) => s.subject).join(", ")}.`
      : "Good balance across subjects.";
  }

  // Save the audit
  const id = crypto.randomUUID();
  await db.insert(db.schema.technocraticAudits).values({
    id, userId: internalUserId, auditType,
    periodStart: since, periodEnd: now,
    metrics, findings, recommendations, score,
    createdAt: now, updatedAt: now,
  });

  const created = await db.query.technocraticAudits.findFirst({ where: (a, { eq }) => eq(a.id, id) });
  return c.json(created, 201);
});

// ════════════════════════════════════════════════════════════════
// Methods CRUD
// ════════════════════════════════════════════════════════════════
technocratic.get("/methods", authMiddleware, zValidator("query", methodPaginationSchema), async (c) => {
  const internalUserId = c.get("internalUserId");
  const { page, limit, category } = c.req.valid("query");
  const db = c.get("db");
  const offset = (page - 1) * limit;

  const conditions = [eq(db.schema.methods.userId, internalUserId)];
  if (category) conditions.push(eq(db.schema.methods.category, category));
  const where = and(...conditions);

  const [results, countResult] = await Promise.all([
    db.select().from(db.schema.methods).where(where)
      .orderBy(desc(db.schema.methods.updatedAt)).limit(limit).offset(offset),
    db.select({ count: sql<number>`count(*)` }).from(db.schema.methods).where(where),
  ]);

  return c.json({
    data: results,
    pagination: { page, limit, total: countResult[0]?.count ?? 0,
      totalPages: Math.ceil((countResult[0]?.count ?? 0) / limit) },
  });
});

technocratic.get("/methods/:id", authMiddleware, async (c) => {
  const id = c.req.param("id");
  const internalUserId = c.get("internalUserId");
  const db = c.get("db");
  const method = await db.query.methods.findFirst({ where: (m, { eq }) => eq(m.id, id) });
  if (!method) return c.json({ error: "Not found" }, 404);
  if (method.userId !== internalUserId) return c.json({ error: "Forbidden" }, 403);
  return c.json(method);
});

technocratic.post("/methods", authMiddleware, zValidator("json", createMethodSchema), async (c) => {
  const internalUserId = c.get("internalUserId");
  const body = c.req.valid("json");
  const db = c.get("db");
  const id = crypto.randomUUID();
  const now = new Date();

  await db.insert(db.schema.methods).values({
    id, userId: internalUserId, name: body.name,
    description: body.description ?? null, category: body.category,
    steps: body.steps ?? [], effectiveness: body.effectiveness ?? null,
    usageCount: 0, isCustom: body.isCustom ?? false,
    createdAt: now, updatedAt: now,
  });

  const created = await db.query.methods.findFirst({ where: (m, { eq }) => eq(m.id, id) });
  return c.json(created, 201);
});

technocratic.put("/methods/:id", authMiddleware, zValidator("json", updateMethodSchema), async (c) => {
  const internalUserId = c.get("internalUserId");
  const id = c.req.param("id");
  const body = c.req.valid("json");
  const db = c.get("db");

  const existing = await db.query.methods.findFirst({ where: (m, { eq }) => eq(m.id, id) });
  if (!existing) return c.json({ error: "Not found" }, 404);
  if (existing.userId !== internalUserId) return c.json({ error: "Forbidden" }, 403);

  const updates: Record<string, unknown> = { updatedAt: new Date() };
  for (const [k, v] of Object.entries(body)) {
    if (v !== undefined) (updates as any)[k] = v;
  }

  await db.update(db.schema.methods).set(updates).where(eq(db.schema.methods.id, id));
  const updated = await db.query.methods.findFirst({ where: (m, { eq }) => eq(m.id, id) });
  return c.json(updated);
});

technocratic.delete("/methods/:id", authMiddleware, async (c) => {
  const internalUserId = c.get("internalUserId");
  const id = c.req.param("id");
  const db = c.get("db");
  const existing = await db.query.methods.findFirst({ where: (m, { eq }) => eq(m.id, id) });
  if (!existing) return c.json({ error: "Not found" }, 404);
  if (existing.userId !== internalUserId) return c.json({ error: "Forbidden" }, 403);
  await db.delete(db.schema.methods).where(eq(db.schema.methods.id, id));
  return c.json({ success: true });
});

export default technocratic;
