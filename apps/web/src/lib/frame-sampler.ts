/**
 * Client-side frame sampler for home walkthrough videos.
 * Uses perceptual hash diff for scene-change detection + quality filtering.
 *
 * Strategy:
 *   1. Uniform sample 20 candidate timestamps across video duration
 *   2. At each timestamp: compute perceptual hash, diff vs previous frame
 *   3. Quality filter: Laplacian variance (blur detection), drop bottom 30%
 *   4. Force-include: 0%, 25%, 50%, 75%, 100% of duration
 *   5. Return up to 20 high-quality, high-information frames
 */

export interface SampledFrame {
  dataUrl: string;         // data:image/jpeg;base64,...
  timestampSeconds: number;
  phash?: string;          // hex perceptual hash
  quality: number;         // 0-1 Laplacian variance score
  isSceneChange: boolean;
}

interface FrameSamplerConfig {
  canvas: HTMLCanvasElement;
  video: HTMLVideoElement;
  targetFrames?: number;        // desired frame count (default 16)
  minQuality?: number;          // minimum Laplacian variance (0-1, default 0.15)
  sceneChangeThreshold?: number; // hash diff threshold (0-1, default 0.12)
}

/**
 * Compute a simple perceptual hash: 32×32 grayscale → 8×8 average → hex.
 * Low-res enough to be fast, high-res enough to detect scene changes.
 */
function computePHash(ctx: CanvasRenderingContext2D, width: number, height: number): string {
  const hashSize = 8;
  // Downsample to hashSize×hashSize
  ctx.drawImage(ctx.canvas, 0, 0, width, height, 0, 0, hashSize, hashSize);
  const imageData = ctx.getImageData(0, 0, hashSize, hashSize);
  const pixels = imageData.data;

  // Compute average brightness
  let sum = 0;
  const grayValues: number[] = [];
  for (let i = 0; i < pixels.length; i += 4) {
    const gray = pixels[i] * 0.299 + pixels[i + 1] * 0.587 + pixels[i + 2] * 0.114;
    grayValues.push(gray);
    sum += gray;
  }
  const avg = sum / grayValues.length;

  // Generate hash bits
  let hash = 0n;
  for (let i = 0; i < grayValues.length; i++) {
    if (grayValues[i] >= avg) hash |= (1n << BigInt(i));
  }
  return hash.toString(16).padStart(16, '0');
}

/** Hamming distance between two hex hash strings (0-1 normalized) */
function phashDiff(hash1: string, hash2: string): number {
  if (!hash1 || !hash2) return 1;
  const b1 = BigInt('0x' + hash1);
  const b2 = BigInt('0x' + hash2);
  let diff = b1 ^ b2;
  let count = 0;
  while (diff) { count++; diff &= diff - 1n; }
  return count / 64; // 8×8 = 64 bits
}

/**
 * Laplacian variance for blur/sharpness detection.
 * Higher = sharper. Returns 0-1 normalized score.
 */
function computeSharpness(ctx: CanvasRenderingContext2D, width: number, height: number): number {
  // Use a small copy for performance
  const sampleW = 64, sampleH = 36;
  ctx.drawImage(ctx.canvas, 0, 0, width, height, 0, 0, sampleW, sampleH);
  const imageData = ctx.getImageData(0, 0, sampleW, sampleH);
  const pixels = imageData.data;

  // Laplacian kernel: [0 -1 0; -1 4 -1; 0 -1 0]
  let sum = 0, sumSq = 0, count = 0;
  for (let y = 1; y < sampleH - 1; y++) {
    for (let x = 1; x < sampleW - 1; x++) {
      const idx = (y * sampleW + x) * 4;
      // Simple Laplacian: approximate with adjacent pixel luminance
      const c = (ox: number, oy: number) => {
        const i = ((y + oy) * sampleW + (x + ox)) * 4;
        return pixels[i] * 0.299 + pixels[i + 1] * 0.587 + pixels[i + 2] * 0.114;
      };
      const lap = c(-1, 0) * -1 + c(1, 0) * -1 + c(0, -1) * -1 + c(0, 1) * -1 + c(0, 0) * 4;
      count++;
      sum += lap;
      sumSq += lap * lap;
    }
  }

  if (count === 0) return 0;
  const mean = sum / count;
  const variance = sumSq / count - mean * mean;
  // Normalize: typical variance range 0-5000
  return Math.min(1, Math.max(0, Math.abs(variance) / 1000));
}

/**
 * Sample high-quality, scene-diverse frames from a video.
 * Client-side: uses provided canvas + video elements.
 */
export async function sampleFrames(config: FrameSamplerConfig): Promise<SampledFrame[]> {
  const { canvas, video, targetFrames = 16, minQuality = 0.15, sceneChangeThreshold = 0.12 } = config;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) throw new Error('Canvas 2D context unavailable');

  const duration = video.duration;
  if (!duration || duration <= 0) throw new Error('Video not loaded');

  const outputWidth = 640;
  const outputHeight = Math.round(outputWidth * (video.videoHeight / video.videoWidth));
  canvas.width = outputWidth;
  canvas.height = outputHeight;

  // ── Phase 1: Uniform candidate timestamps ────────────────────────
  const candidates: Array<{ timestamp: number; forced: boolean }> = [];
  const interval = duration / (targetFrames - 1);

  for (let i = 0; i < targetFrames; i++) {
    const t = Math.min(i * interval, duration - 0.1);
    const forced = i === 0 || i === Math.floor(targetFrames / 4) ||
                  i === Math.floor(targetFrames / 2) ||
                  i === Math.floor(3 * targetFrames / 4) ||
                  i === targetFrames - 1;
    candidates.push({ timestamp: t, forced });
  }

  // ── Phase 2: Capture + analyze each candidate ────────────────────
  const results: SampledFrame[] = [];
  let lastPhash = '';

  for (const { timestamp, forced } of candidates) {
    // Seek to timestamp
    await new Promise<void>(resolve => {
      video.currentTime = timestamp;
      video.onseeked = () => {
        ctx.drawImage(video, 0, 0, outputWidth, outputHeight);
        resolve();
      };
    });

    const phash = computePHash(ctx, outputWidth, outputHeight);
    const quality = computeSharpness(ctx, outputWidth, outputHeight);
    const diff = phashDiff(phash, lastPhash);
    const isSceneChange = diff >= sceneChangeThreshold;

    // Quality filter: skip blurry frames unless forced
    if (!forced && quality < minQuality) {
      continue;
    }

    // Scene-change filter: skip duplicates unless forced
    if (!forced && !isSceneChange && results.length > 0) {
      continue;
    }

    const dataUrl = canvas.toDataURL('image/jpeg', 0.75);
    results.push({ dataUrl, timestampSeconds: timestamp, phash, quality, isSceneChange });
    lastPhash = phash;
  }

  // ── Phase 3: Quality sort + trim bottom 30% ──────────────────────
  // Keep forced frames regardless of quality
  const forcedFrames = results.filter(r =>
    r.timestampSeconds <= 0.1 ||
    Math.abs(r.timestampSeconds - duration * 0.25) < 0.5 ||
    Math.abs(r.timestampSeconds - duration * 0.5) < 0.5 ||
    Math.abs(r.timestampSeconds - duration * 0.75) < 0.5 ||
    r.timestampSeconds >= duration - 0.5
  );

  const nonForced = results.filter(r => !forcedFrames.includes(r));
  nonForced.sort((a, b) => b.quality - a.quality);

  const keepCount = Math.max(0, nonForced.length - Math.floor(nonForced.length * 0.3));
  const keptNonForced = nonForced.slice(0, keepCount);

  // Merge, sort by timestamp
  const final = [...forcedFrames, ...keptNonForced]
    .filter((f, i, arr) => arr.findIndex(x => x.dataUrl === f.dataUrl) === i) // dedup
    .sort((a, b) => a.timestampSeconds - b.timestampSeconds);

  console.log(`[frame-sampler] ${candidates.length} candidates → ${results.length} post-filter → ${final.length} final (${forcedFrames.length} forced)`);
  return final.slice(0, targetFrames);
}
