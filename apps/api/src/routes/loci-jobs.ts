import { Hono } from "hono";
import type { Env } from "../index";
import { authMiddleware } from "../middleware/auth";
import { chunkText, type ChunkResult } from "../services/chunker";
import { eq, and, sql } from "drizzle-orm";

const lociJobs = new Hono<{ Bindings: Env; Variables: Record<string, any> }>();

const MAX_UPLOAD_BYTES = 50 * 1024 * 1024; // 50 MB

// ════════════════════════════════════════════════════════════════
// POST /api/loci-jobs — Upload document, parse, chunk, enqueue
// Returns jobId immediately. Client polls or uses SSE for progress.
// ════════════════════════════════════════════════════════════════
lociJobs.post("/", authMiddleware, async (c) => {
  const requestId = crypto.randomUUID();
  const internalUserId = c.get("internalUserId");
  const db = c.get("db");

  try {
    const contentType = c.req.header("content-type") || "";
    let plaintext = "";
    let fileName = "untitled.txt";
    let fileSize = 0;
    let r2Key: string | undefined;

    // ── Multipart file upload ────────────────────────────────────
    if (contentType.includes("multipart/form-data")) {
      const formData = await c.req.formData();
      const file = formData.get("file");
      const topicFromForm = formData.get("topic")?.toString();

      if (file && file instanceof File) {
        fileName = file.name;
        fileSize = file.size;

        if (fileSize > MAX_UPLOAD_BYTES) {
          return c.json({ error: "file_too_large", maxBytes: MAX_UPLOAD_BYTES, actualBytes: fileSize, requestId }, 413);
        }

        const ext = fileName.split(".").pop()?.toLowerCase();
        const textTypes = ["txt", "md", "markdown", "csv", "json", "xml", "html", "htm", "srt", "vtt"];
        const isTextFile = textTypes.includes(ext || "");

        if (isTextFile) {
          plaintext = await file.text();
        } else {
          // Store binary (PDF/DOCX/etc.) to R2 for later async parsing
          r2Key = `loci-uploads/${internalUserId}/${Date.now()}-${encodeURIComponent(fileName)}`;
          const buffer = await file.arrayBuffer();
          const storage = c.env.STORAGE ?? c.env.ASSETS;
          if (storage) {
            await storage.put(r2Key, buffer, {
              httpMetadata: { contentType: file.type || "application/octet-stream" },
            });
          }
          // For now, binary files just get a placeholder — real parsing is a future addition
          plaintext = `[Binary file: ${fileName} (${fileSize} bytes). Full parsing for PDF/DOCX coming soon.]`;
        }
      }

      // Also handle raw text in the form
      if (!plaintext) {
        const textField = formData.get("text");
        if (textField) plaintext = textField.toString();
      }
    } else {
      // ── JSON body (text paste) ──────────────────────────────────
      const body = await c.req.json().catch(() => ({}));
      plaintext = body.text || body.content || "";
      fileName = body.fileName || "pasted-text.txt";
    }

    if (!plaintext.trim()) {
      return c.json({ error: "validation_failed", reason: "empty_content", requestId }, 400);
    }

    const topic = c.req.query("topic") || "Study Material";

    // ── Create job ────────────────────────────────────────────────
    const jobId = crypto.randomUUID();
    const estimatedTokens = Math.ceil(plaintext.length / 4);

    await db.insert(db.schema.lociJobs).values({
      id: jobId,
      userId: internalUserId,
      fileName,
      fileSize,
      r2Key: r2Key || null,
      topic,
      totalChunks: 0,
      completedChunks: 0,
      status: "parsing",
      plaintextLength: plaintext.length,
      estimatedTokens,
      createdAt: new Date(),
      updatedAt: new Date(),
    } as any);

    // ── Chunk the text ────────────────────────────────────────────
    const chunks = chunkText(plaintext, jobId);

    if (chunks.length === 0) {
      await db.update(db.schema.lociJobs)
        .set({ status: "failed", error: "No content to chunk", updatedAt: new Date() } as any)
        .where(eq(db.schema.lociJobs.id, jobId));
      return c.json({ error: "no_content", requestId }, 400);
    }

    // ── Insert chunks into D1 ─────────────────────────────────────
    for (const chunk of chunks) {
      await db.insert(db.schema.lociChunks).values({
        id: chunk.chunkId,
        jobId,
        sequenceIndex: chunk.sequenceIndex,
        text: chunk.text,
        tokenCount: chunk.tokenCount,
        sectionTitle: chunk.sectionTitle || null,
        status: "pending",
        retryCount: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      } as any);
    }

    // ── Update job with chunk count ───────────────────────────────
    await db.update(db.schema.lociJobs)
      .set({
        totalChunks: chunks.length,
        status: "generating",
        updatedAt: new Date(),
      } as any)
      .where(eq(db.schema.lociJobs.id, jobId));

    // ── Process ALL chunks in background (waitUntil) ──────────────
    // POST returns jobId immediately; SSE stream picks up results
    // Queue consumer is unreliable; background processing is the real path
    c.executionCtx.waitUntil((async () => {
      const { generateLociForChunk } = await import("../services/ai");
      for (const chunk of chunks) {
        try {
          console.log(`[loci-jobs] Processing chunk ${chunk.sequenceIndex}/${chunks.length}`);
          const loci = await generateLociForChunk(c.env, chunk.text, topic, chunk.sectionTitle);
          await db.update(db.schema.lociChunks)
            .set({ status: "done", loci: JSON.stringify(loci), updatedAt: new Date() } as any)
            .where(eq(db.schema.lociChunks.id, chunk.chunkId));
          await db.update(db.schema.lociJobs)
            .set({ completedChunks: sql`completed_chunks + 1`, updatedAt: new Date() } as any)
            .where(eq(db.schema.lociJobs.id, jobId));
          console.log(`[loci-jobs] Chunk ${chunk.sequenceIndex} done`);
        } catch (e) {
          console.error(`[loci-jobs] Chunk ${chunk.sequenceIndex} failed:`, (e as any)?.message);
          await db.update(db.schema.lociChunks)
            .set({ status: "failed", error: String((e as any)?.message || "").slice(0, 500), updatedAt: new Date() } as any)
            .where(eq(db.schema.lociChunks.id, chunk.chunkId));
        }
      }
      // Mark job complete
      const finalJob = await db.query.lociJobs.findFirst({
        where: (j: any, { eq: any }: any) => eq(j.id, jobId),
      });
      if (finalJob && finalJob.completedChunks >= finalJob.totalChunks) {
        await db.update(db.schema.lociJobs)
          .set({ status: "completed", updatedAt: new Date() } as any)
          .where(eq(db.schema.lociJobs.id, jobId));
        console.log(`[loci-jobs] Job ${jobId} completed`);
      }
    })());

    console.log(`[loci-jobs] Job ${jobId}: ${chunks.length} chunks enqueued (${plaintext.length} chars, ~${estimatedTokens} tokens)`);

    return c.json({
      jobId,
      status: "generating",
      totalChunks: chunks.length,
      completedChunks: 0,
      estimatedTokens,
      requestId,
    }, 202);

  } catch (e: any) {
    const msg = String(e?.message ?? "");
    const code = msg.includes("parse") || msg.includes("JSON") ? "PARSE_FAILED"
      : msg.includes("chunk") || msg.includes("empty") ? "CHUNKING_FAILED"
      : msg.includes("queue") ? "QUEUE_FAILED"
      : msg.includes("timeout") || msg.includes("abort") ? "API_TIMEOUT"
      : msg.includes("cap") || msg.includes("cost") ? "COST_CAP_HIT"
      : "JOB_CREATION_FAILED";

    console.error("[loci-jobs.create.fail]", JSON.stringify({
      requestId, code, msg: msg.slice(0, 300),
    }));
    return c.json({
      error: "job_creation_failed",
      code,
      detail: msg.slice(0, 200),
      requestId,
    }, 500);
  }
});

// ════════════════════════════════════════════════════════════════
// GET /api/loci-jobs/:jobId — Job status + collected loci
// ════════════════════════════════════════════════════════════════
lociJobs.get("/:jobId", authMiddleware, async (c) => {
  const jobId = c.req.param("jobId")!;
  const db = c.get("db");

  const job = await db.query.lociJobs.findFirst({
    where: (j: any, { eq }: any) => eq(j.id, jobId),
  });

  if (!job) return c.json({ error: "not_found" }, 404);

  // Collect completed loci from chunks
  const completedChunks = await db.select()
    .from(db.schema.lociChunks)
    .where(and(
      eq(db.schema.lociChunks.jobId, jobId),
      eq(db.schema.lociChunks.status, "done"),
    ))
    .orderBy(db.schema.lociChunks.sequenceIndex)
    .all();

  const allLoci: any[] = [];
  for (const chunk of completedChunks) {
    if (chunk.loci) {
      try {
        const parsed = JSON.parse(chunk.loci);
        allLoci.push(...(Array.isArray(parsed) ? parsed : []));
      } catch { /* skip malformed JSON */ }
    }
  }

  return c.json({
    jobId: job.id,
    status: job.status,
    totalChunks: job.totalChunks,
    completedChunks: job.completedChunks,
    error: job.error,
    loci: allLoci,
    fileName: job.fileName,
    estimatedTokens: job.estimatedTokens,
  });
});

// ════════════════════════════════════════════════════════════════
// GET /api/loci-jobs/:jobId/stream — SSE progress stream
// ════════════════════════════════════════════════════════════════
lociJobs.get("/:jobId/stream", authMiddleware, async (c) => {
  const jobId = c.req.param("jobId")!;
  const db = c.get("db");

  // Check job exists
  const job = await db.query.lociJobs.findFirst({
    where: (j: any, { eq }: any) => eq(j.id, jobId),
  });
  if (!job) return c.json({ error: "not_found" }, 404);

  let lastCompleted = job.completedChunks ?? 0;

  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder();
      const send = (data: string) => controller.enqueue(encoder.encode(`data: ${data}\n\n`));

      // Send initial state
      send(JSON.stringify({
        type: "init",
        jobId,
        totalChunks: job.totalChunks,
        completedChunks: lastCompleted,
        status: job.status,
      }));

      // Poll for updates every 500ms, max 10 minutes
      const maxPolls = 1200; // 1200 × 500ms = 10min
      for (let poll = 0; poll < maxPolls; poll++) {
        await new Promise(r => setTimeout(r, 500));

        try {
          const updated = await db.query.lociJobs.findFirst({
            where: (j: any, { eq }: any) => eq(j.id, jobId),
          });

          if (!updated) {
            send(JSON.stringify({ type: "error", error: "Job not found" }));
            controller.close();
            return;
          }

          const completed = updated.completedChunks ?? 0;
          const total = updated.totalChunks ?? 0;

          // Fetch newly completed loci
          if (completed > lastCompleted) {
            const newChunks = await db.select()
              .from(db.schema.lociChunks)
              .where(and(
                eq(db.schema.lociChunks.jobId, jobId),
                eq(db.schema.lociChunks.status, "done"),
              ))
              .orderBy(db.schema.lociChunks.sequenceIndex)
              .all();

            const newLoci: any[] = [];
            for (const chunk of newChunks) {
              if (chunk.loci) {
                try {
                  const parsed = JSON.parse(chunk.loci);
                  newLoci.push(...(Array.isArray(parsed) ? parsed : []));
                } catch { /* skip */ }
              }
            }

            send(JSON.stringify({
              type: "progress",
              completedChunks: completed,
              totalChunks: total,
              newLoci,
              allLoci: newLoci,
            }));

            lastCompleted = completed;
          }

          // Terminal states
          if (updated.status === "completed") {
            send(JSON.stringify({ type: "complete", totalLoci: lastCompleted }));
            controller.close();
            return;
          }
          if (updated.status === "failed") {
            send(JSON.stringify({ type: "error", error: updated.error || "Generation failed" }));
            controller.close();
            return;
          }
        } catch (e) {
          // DB query failed — keep polling
          console.error("[loci-jobs.stream.poll-err]", e);
        }
      }

      // Timeout
      send(JSON.stringify({ type: "error", error: "Stream timeout — job may still be processing" }));
      controller.close();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",  // Disable nginx buffering
    },
  });
});

// ════════════════════════════════════════════════════════════════
// POST /api/loci-jobs/estimate-cost — Token-count + cost preview
// ════════════════════════════════════════════════════════════════
lociJobs.post("/estimate-cost", authMiddleware, async (c) => {
  try {
    const body = await c.req.json().catch(() => ({}));
    const text = body.text || "";

    if (!text.trim()) {
      return c.json({ error: "no_text" }, 400);
    }

    const { checkCostCap } = await import("../services/cost");
    const tier = c.get("userTier") || "free";
    const result = checkCostCap(text, tier);

    const chunks = Math.ceil(result.estimatedTokens / 2000);
    const warning = !result.withinCap
      ? `This document exceeds your plan's HK$${result.cap} cap. Only the first ~${Math.floor(result.estimatedTokens * (result.cap / result.estimatedCost))} tokens will be processed.`
      : result.estimatedCost > 5
        ? `Estimated cost: HK$${result.estimatedCost}. This is within your plan limit.`
        : null;

    return c.json({
      estimatedTokens: result.estimatedTokens,
      estimatedCost: result.estimatedCost,
      estimatedChunks: chunks,
      cap: result.cap,
      withinCap: result.withinCap,
      warning,
    });
  } catch (e: any) {
    return c.json({ error: String(e?.message ?? "") }, 500);
  }
});

// ════════════════════════════════════════════════════════════════
// POST /api/loci-jobs/:jobId/retry-chunks — Retry failed chunks
// ════════════════════════════════════════════════════════════════
lociJobs.post("/:jobId/retry-chunks", authMiddleware, async (c) => {
  const jobId = c.req.param("jobId")!;
  const db = c.get("db");

  const job = await db.query.lociJobs.findFirst({
    where: (j: any, { eq: any }: any) => eq(j.id, jobId),
  });
  if (!job) return c.json({ error: "not_found" }, 404);

  // Find failed chunks and reset them to pending
  const failedChunks = await db.select()
    .from(db.schema.lociChunks)
    .where(and(
      eq(db.schema.lociChunks.jobId, jobId),
      eq(db.schema.lociChunks.status, "failed"),
    ))
    .all();

  if (failedChunks.length === 0) {
    return c.json({ retried: 0, message: "No failed chunks to retry" });
  }

  // Reset to pending
  for (const chunk of failedChunks) {
    await db.update(db.schema.lociChunks)
      .set({ status: "pending", retryCount: 0, error: null, updatedAt: new Date() } as any)
      .where(eq(db.schema.lociChunks.id, chunk.id));
  }

  // Re-enqueue
  const topic = job.topic || "Study Material";
  const BATCH_SIZE = 10;
  for (let i = 0; i < failedChunks.length; i += BATCH_SIZE) {
    const batch = failedChunks.slice(i, i + BATCH_SIZE);
    try {
      await c.env.AI_QUEUE.send(batch.map(chunk => ({
        type: "process-loci-chunk",
        userId: job.userId,
        payload: { jobId, chunkId: chunk.id, topic },
      })));
    } catch (e) { /* queue send failure non-fatal */ }
  }

  // Reset job status if it was failed
  if (job.status === "failed" || job.status === "cost_capped") {
    await db.update(db.schema.lociJobs)
      .set({ status: "generating", error: null, updatedAt: new Date() } as any)
      .where(eq(db.schema.lociJobs.id, jobId));
  }

  return c.json({ retried: failedChunks.length });
});

// ════════════════════════════════════════════════════════════════
// GET /api/loci-jobs/:jobId/debug — Full job state for support
// ════════════════════════════════════════════════════════════════
lociJobs.get("/:jobId/debug", authMiddleware, async (c) => {
  const jobId = c.req.param("jobId")!;
  const db = c.get("db");

  const job = await db.query.lociJobs.findFirst({
    where: (j: any, { eq: any }: any) => eq(j.id, jobId),
  });
  if (!job) return c.json({ error: "not_found" }, 404);

  const chunks = await db.select()
    .from(db.schema.lociChunks)
    .where(eq(db.schema.lociChunks.jobId, jobId))
    .orderBy(db.schema.lociChunks.sequenceIndex)
    .all();

  const chunkSummary = chunks.map(c => ({
    sequenceIndex: c.sequenceIndex,
    status: c.status,
    tokenCount: c.tokenCount,
    retryCount: c.retryCount,
    error: c.error?.slice(0, 100),
    lociCount: c.loci ? (() => { try { return JSON.parse(c.loci).length } catch { return 0 } })() : 0,
    sectionTitle: c.sectionTitle,
  }));

  return c.json({
    job: {
      id: job.id,
      userId: job.userId,
      status: job.status,
      fileName: job.fileName,
      fileSize: job.fileSize,
      topic: job.topic,
      totalChunks: job.totalChunks,
      completedChunks: job.completedChunks,
      error: job.error,
      plaintextLength: job.plaintextLength,
      estimatedTokens: job.estimatedTokens,
      costHkd: job.costHkd,
      createdAt: job.createdAt,
      updatedAt: job.updatedAt,
    },
    chunks: chunkSummary,
    statusCounts: {
      pending: chunkSummary.filter(c => c.status === "pending").length,
      processing: chunkSummary.filter(c => c.status === "processing").length,
      done: chunkSummary.filter(c => c.status === "done").length,
      failed: chunkSummary.filter(c => c.status === "failed").length,
    },
  });
});

export default lociJobs;
