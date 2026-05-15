import { Hono } from "hono";
import type { Env } from "../index";
import { authMiddleware } from "../middleware/auth";

const exports_ = new Hono<{ Bindings: Env; Variables: Record<string, any> }>();

// GET /api/exports/palace/:id?format=md — Export palace as markdown
exports_.get("/palace/:id", authMiddleware, async (c) => {
  const internalUserId = c.get("internalUserId");
  const palaceId = c.req.param("id")!;
  const format = c.req.query("format") || "md";
  const db = c.get("db");

  try {
    const palace = await db.query.memoryPalaces.findFirst({
      where: (p: any, { eq }: any) => eq(p.id, palaceId),
    });
    if (!palace) return c.json({ error: "not_found" }, 404);
    if (palace.userId !== internalUserId) return c.json({ error: "forbidden" }, 403);

    const loci = (palace.loci || []) as Array<{ concept: string; description: string; mnemonic: string }>;

    if (format === "csv") {
      let csv = "Index,Concept,Description,Mnemonic\n";
      for (let i = 0; i < loci.length; i++) {
        csv += `${i + 1},"${loci[i].concept}","${(loci[i].description || '').replace(/"/g, '""')}","${(loci[i].mnemonic || '').replace(/"/g, '""')}"\n`;
      }
      return new Response(csv, {
        headers: { "Content-Type": "text/csv", "Content-Disposition": `attachment; filename="${palace.name}.csv"` },
      });
    }

    // Default: Markdown
    let md = `# ${palace.name}\n\n`;
    md += `> ${palace.description || 'Memory Palace'}\n\n`;
    md += `**Subject:** ${palace.subject || 'General'} | **Loci:** ${loci.length}\n\n`;
    md += `---\n\n`;
    for (let i = 0; i < loci.length; i++) {
      md += `## ${i + 1}. ${loci[i].concept}\n\n`;
      md += `${loci[i].description || ''}\n\n`;
      if (loci[i].mnemonic) md += `> 💡 ${loci[i].mnemonic}\n\n`;
    }
    return new Response(md, {
      headers: { "Content-Type": "text/markdown", "Content-Disposition": `attachment; filename="${palace.name}.md"` },
    });
  } catch (e: any) {
    return c.json({ error: "export_failed", detail: String(e?.message ?? "").slice(0, 200) }, 500);
  }
});

export default exports_;
