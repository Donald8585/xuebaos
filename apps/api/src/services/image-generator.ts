/**
 * Image Generator Service — Phase 3
 * Generates AI images for memory palace loci using Flux Schnell via Replicate.
 *
 * Cost: ~$0.003 USD per image (Flux Schnell, 1024×768, 4 steps)
 * Tier caps: free=5/month, xueba=50/month, pro=200/month, founder=500/month, xueshen=unlimited
 */

import type { Env } from "../index";
import { eq } from "drizzle-orm";

// ── Pricing & Caps ──────────────────────────────────────────────────
const FLUX_SCHNELL_COST_CENTS = 0.3; // ~$0.003 USD per image
const FLUX_SCHNELL_BATCH_SIZE = 3;   // parallel generations

const IMAGE_MONTHLY_LIMITS: Record<string, number> = {
  free: 5,
  xueba: 50,
  pro: 200,
  founder: 500,
  xueshen: 999999,
};

// ── Prompt Template ──────────────────────────────────────────────────
export function buildImagePrompt(
  locusText: string,
  roomName?: string,
  stylePreference?: string
): string {
  const style = stylePreference || "photorealistic";
  const roomContext = roomName ? `Setting: ${roomName} of a memory palace. ` : "";
  return `An evocative scene representing: ${locusText}. ${roomContext}Style: ${style}. Vivid, memorable, high contrast, cinematic lighting.`;
}

// ── Tier Check ───────────────────────────────────────────────────────
export function getImageMonthlyLimit(tier?: string): number {
  return IMAGE_MONTHLY_LIMITS[tier ?? "free"] ?? IMAGE_MONTHLY_LIMITS.free;
}

export async function checkImageQuota(
  db: any,
  userId: string,
  tier?: string
): Promise<{ allowed: boolean; usedThisMonth: number; limit: number }> {
  const limit = getImageMonthlyLimit(tier);
  if (limit >= 999999) return { allowed: true, usedThisMonth: 0, limit };

  const thisMonthStart = Math.floor(
    new Date(new Date().getFullYear(), new Date().getMonth(), 1).getTime() / 1000
  );

  const rows = await db
    .select({ count: db._.sql`count(*)` })
    .from(db.schema.lociImages)
    .where(
      db._.and(
        eq(db.schema.lociImages.userId, userId),
        db._.sql`created_at >= ${thisMonthStart}`,
        eq(db.schema.lociImages.status, "done")
      )
    )
    .all();

  const usedThisMonth = Number(rows?.[0]?.count ?? 0);
  return { allowed: usedThisMonth < limit, usedThisMonth, limit };
}

// ── Single Image Generation ──────────────────────────────────────────
export async function generateLocusImage(
  env: Env,
  concept: string,
  roomName?: string,
  stylePreference?: string
): Promise<{ imageUrl: string; generationTimeMs: number; costCents: number }> {
  const prompt = buildImagePrompt(concept, roomName, stylePreference);
  const startTime = Date.now();

  const resp = await fetch("https://api.replicate.com/v1/predictions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Token ${env.REPLICATE_API_TOKEN}`,
    },
    body: JSON.stringify({
      version: "black-forest-labs/flux-schnell",
      input: {
        prompt,
        width: 1024,
        height: 768,
        num_outputs: 1,
        num_inference_steps: 4,
      },
    }),
  });

  if (!resp.ok) {
    const err = await resp.text().catch(() => "");
    throw new Error(`Replicate API error (${resp.status}): ${err.slice(0, 200)}`);
  }

  const prediction = (await resp.json()) as { id: string; status: string };

  // Poll for completion — Flux Schnell typically finishes in 2–8s
  let attempts = 0;
  const maxAttempts = 30; // 60s max
  while (attempts < maxAttempts) {
    const pollResp = await fetch(
      `https://api.replicate.com/v1/predictions/${prediction.id}`,
      {
        headers: { Authorization: `Token ${env.REPLICATE_API_TOKEN}` },
      }
    );

    if (!pollResp.ok) throw new Error("Failed to poll Replicate prediction");

    const result = (await pollResp.json()) as {
      status: string;
      output?: string[];
      error?: string;
    };

    if (result.status === "succeeded") {
      return {
        imageUrl: result.output?.[0] ?? "",
        generationTimeMs: Date.now() - startTime,
        costCents: FLUX_SCHNELL_COST_CENTS,
      };
    }
    if (result.status === "failed") {
      throw new Error(`Replicate generation failed: ${result.error}`);
    }

    await new Promise((r) => setTimeout(r, 2000));
    attempts++;
  }

  throw new Error("Replicate generation timed out after 60s");
}

// ── Batch Generation for a Loci Job ──────────────────────────────────
/**
 * Generate images for all loci in a completed job.
 * Processes in batches of FLUX_SCHNELL_BATCH_SIZE for parallelism.
 * Respects tier quotas — stops when limit is hit.
 */
export async function generateImagesForLociJob(
  env: Env,
  db: any,
  jobId: string,
  palaceId: string,
  loci: Array<{ concept: string; description: string }>,
  spatialMap?: Array<{ roomId?: string; name?: string }>,
  tier?: string
): Promise<{ generated: number; skipped: number; failed: number }> {
  const job = await db.query.lociJobs.findFirst({
    where: (j: any, { eq: any }: any) => eq(j.id, jobId),
  });
  if (!job) throw new Error("Job not found");

  const userId = job.userId;
  let generated = 0;
  let skipped = 0;
  let failed = 0;

  // ── Quota check ────────────────────────────────────────────────────
  const quota = await checkImageQuota(db, userId, tier);
  if (!quota.allowed) {
    console.log(`[image-gen] Quota exceeded for user ${userId}: ${quota.usedThisMonth}/${quota.limit}`);
    return { generated: 0, skipped: loci.length, failed: 0 };
  }

  const remainingQuota = quota.limit - quota.usedThisMonth;
  const lociToProcess = loci.slice(0, remainingQuota);

  // ── Create pending image records ────────────────────────────────────
  for (let i = 0; i < lociToProcess.length; i++) {
    const locus = lociToProcess[i];
    const roomInfo = spatialMap?.[i];
    const roomName = roomInfo?.name || roomInfo?.roomId || undefined;
    const prompt = buildImagePrompt(locus.concept, roomName);

    await db.insert(db.schema.lociImages).values({
      id: crypto.randomUUID(),
      locusIndex: i,
      palaceId,
      jobId,
      userId,
      concept: locus.concept,
      roomName,
      prompt,
      status: "pending",
      costCents: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    } as any);
  }

  // ── Process in batches ──────────────────────────────────────────────
  for (let batchStart = 0; batchStart < lociToProcess.length; batchStart += FLUX_SCHNELL_BATCH_SIZE) {
    const batch = lociToProcess.slice(batchStart, batchStart + FLUX_SCHNELL_BATCH_SIZE);
    const batchIndex = batchStart;

    const batchPromises = batch.map(async (locus, i) => {
      const globalIndex = batchIndex + i;
      const roomInfo = spatialMap?.[globalIndex];
      const imageRecord = await db.query.lociImages.findFirst({
        where: (img: any, { and, eq: any }: any) =>
          and(eq(img.jobId, jobId), eq(img.locusIndex, globalIndex)),
      });

      if (!imageRecord) {
        skipped++;
        return;
      }

      // Mark as generating
      await db.update(db.schema.lociImages)
        .set({ status: "generating", updatedAt: new Date() } as any)
        .where(eq(db.schema.lociImages.id, imageRecord.id));

      try {
        const result = await generateLocusImage(
          env,
          locus.concept,
          roomInfo?.name || roomInfo?.roomId || imageRecord.roomName || undefined
        );

        await db.update(db.schema.lociImages)
          .set({
            status: "done",
            imageUrl: result.imageUrl,
            generationTimeMs: result.generationTimeMs,
            costCents: result.costCents,
            updatedAt: new Date(),
          } as any)
          .where(eq(db.schema.lociImages.id, imageRecord.id));

        generated++;
        console.log(`[image-gen] Locus ${globalIndex} done in ${result.generationTimeMs}ms`);
      } catch (e: any) {
        const errMsg = String(e?.message ?? "").slice(0, 500);
        await db.update(db.schema.lociImages)
          .set({
            status: "failed",
            error: errMsg,
            updatedAt: new Date(),
          } as any)
          .where(eq(db.schema.lociImages.id, imageRecord.id));

        failed++;
        console.error(`[image-gen] Locus ${globalIndex} failed:`, errMsg);
      }
    });

    await Promise.allSettled(batchPromises);
  }

  console.log(`[image-gen] Job ${jobId}: ${generated} generated, ${skipped} skipped, ${failed} failed`);
  return { generated, skipped, failed };
}
