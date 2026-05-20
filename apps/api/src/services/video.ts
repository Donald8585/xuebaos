import type { Env } from "../index";

/**
 * Video service — handles video metadata extraction.
 * Cloudflare Workers can't run FFmpeg, so scene extraction is done
 * client-side via <video> + <canvas>. This service handles metadata
 * and stores scene thumbnails uploaded from the client.
 */

interface VideoMetadata {
  durationSeconds: number;
  fileSize: number;
  fileName: string;
}

/** Parse basic video metadata from an R2 object */
export async function getVideoMetadata(
  env: Env,
  r2Key: string
): Promise<VideoMetadata | null> {
  try {
    const object = await env.STORAGE.head(r2Key);
    if (!object) return null;

    return {
      durationSeconds: 0, // Filled client-side
      fileSize: object.size,
      fileName: r2Key.split("/").pop() || "unknown",
    };
  } catch {
    return null;
  }
}

/** Upload a scene thumbnail (base64 JPEG) to R2 IMAGES */
export async function storeSceneThumbnail(
  env: Env,
  videoId: string,
  timestampSeconds: number,
  base64Data: string
): Promise<{ key: string; publicUrl: string }> {
  const key = `scenes/${videoId}/${timestampSeconds}.jpg`;
  
  // Strip data URI prefix if present
  const match = base64Data.match(/^data:image\/\w+;base64,(.+)$/);
  const b64 = match ? match[1] : base64Data;
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }

  const bucket = env.IMAGES || env.STORAGE;
  await bucket.put(key, bytes.buffer, {
    httpMetadata: { contentType: "image/jpeg" },
  });

  return { key, publicUrl: `/api/storage/${key}` };
}

/** Delete a video and all its scene thumbnails from R2 */
export async function deleteVideoAssets(
  env: Env,
  videoId: string,
  r2Key: string
): Promise<void> {
  try {
    await env.STORAGE.delete(r2Key);
    // Delete scene thumbnails (best-effort via listing)
    const bucket = env.IMAGES || env.STORAGE;
    const prefix = `scenes/${videoId}/`;
    const listed = await bucket.list({ prefix });
    for (const obj of listed.objects) {
      await bucket.delete(obj.key);
    }
  } catch (e) {
    console.error("[video.delete] Failed to delete assets:", e);
  }
}
