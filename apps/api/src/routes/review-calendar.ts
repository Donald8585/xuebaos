import { Hono } from "hono";
import { eq, and, lt } from "drizzle-orm";
import type { Env } from "../index";
import { authMiddleware } from "../middleware/auth";
import { TABLES } from "../db/schema";
import { retrievability, cardFromQuestion } from "../services/fsrs";

const calendar = new Hono<{ Bindings: Env; Variables: Record<string, any> }>();

// GET /api/reviews/calendar — Upcoming reviews grouped by date
calendar.get("/", authMiddleware, async (c) => {
  const internalUserId = c.get("internalUserId");
  const db = c.get("db");
  const now = Math.floor(Date.now() / 1000);

  // Get all due + upcoming cards for next 30 days
  const thirtyDays = now + 86400 * 30;
  const cards = await db.select()
    .from(TABLES.questions)
    .where(and(
      eq(TABLES.questions.userId, internalUserId),
      lt(TABLES.questions.fsrsDue as any, thirtyDays),
    ))
    .orderBy(TABLES.questions.fsrsDue);

  // Group by date
  const byDate: Record<string, Array<{ id: string; text: string; subject: string; retrievability: number }>> = {};
  for (const q of cards as any[]) {
    const dueDate = new Date((q.fsrsDue || 0) * 1000).toISOString().slice(0, 10);
    const card = cardFromQuestion(q);
    const r = retrievability(card.elapsedDays, card.stability);
    if (!byDate[dueDate]) byDate[dueDate] = [];
    byDate[dueDate].push({ id: q.id, text: q.questionText?.slice(0, 60) || q.topic || 'Untitled', subject: q.subject, retrievability: Math.round(r * 100) / 100 });
  }

  return c.json({ calendar: byDate, totalCards: cards.length });
});

// GET /api/reviews/calendar.ics — iCal feed (signed URL stub)
calendar.get("/ics", authMiddleware, async (c) => {
  const internalUserId = c.get("internalUserId");
  const db = c.get("db");
  const now = Math.floor(Date.now() / 1000);
  const thirtyDays = now + 86400 * 30;
  const cards = await db.select()
    .from(TABLES.questions)
    .where(and(eq(TABLES.questions.userId, internalUserId), lt(TABLES.questions.fsrsDue as any, thirtyDays)));

  let ics = "BEGIN:VCALENDAR\r\nVERSION:2.0\r\nPRODID:-//XueBaOS//EN\r\n";
  for (const q of cards as any[]) {
    const due = new Date((q.fsrsDue || 0) * 1000);
    const end = new Date(due.getTime() + 15 * 60000);
    ics += `BEGIN:VEVENT\r\nDTSTART:${due.toISOString().replace(/[-:]/g, "").slice(0, 15)}Z\r\n`;
    ics += `DTEND:${end.toISOString().replace(/[-:]/g, "").slice(0, 15)}Z\r\n`;
    ics += `SUMMARY:XueBaOS Review: ${q.topic || q.subject || 'Study'}\r\n`;
    ics += `UID:${q.id}@xuebaos.com\r\nEND:VEVENT\r\n`;
  }
  ics += "END:VCALENDAR\r\n";

  return new Response(ics, { headers: { "Content-Type": "text/calendar", "Content-Disposition": "attachment; filename=xuebaos-reviews.ics" } });
});

export default calendar;
