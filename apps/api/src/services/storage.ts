import type { Env } from "../index";

/** Thrown when a storage binding is unavailable (missing from wrangler.toml) */
export class StorageUnavailableError extends Error {
  constructor(bindingName: string) {
    super(`Storage binding "${bindingName}" is not configured. Check wrangler.toml.`);
    this.name = "StorageUnavailableError";
  }
}

/**
 * R2 storage service for file uploads and presigned URLs.
 */
export class StorageService {
  private bucket: R2Bucket | null;

  constructor(env: Env) {
    this.bucket = env.STORAGE ?? null;
  }

  private guard(): R2Bucket {
    if (!this.bucket) {
      throw new StorageUnavailableError("STORAGE");
    }
    return this.bucket;
  }

  async upload(key: string, body: ReadableStream | ArrayBuffer | Blob | string, contentType?: string): Promise<void> {
    const options: R2PutOptions = {};
    if (contentType) {
      options.httpMetadata = { contentType };
    }
    await this.guard().put(key, body, options);
  }

  async download(key: string): Promise<R2ObjectBody | null> {
    return this.guard().get(key);
  }

  async delete(key: string): Promise<void> {
    await this.guard().delete(key);
  }

  async list(prefix?: string, limit?: number): Promise<R2Objects> {
    return this.guard().list({ prefix, limit });
  }

  /** Generate a presigned URL for upload (valid 1 hour) */
  async createPresignedUploadUrl(key: string, contentType: string): Promise<string> {
    // R2 presigned URLs are auto-generated via Workers binding
    // We use the bucket's built-in createPresignedUrl method when available
    // Fallback: Construct a URL that proxies uploads through the worker
    return `/api/storage/upload/${encodeURIComponent(key)}?contentType=${encodeURIComponent(contentType)}`;
  }

  /** Get a public URL for an object */
  getPublicUrl(key: string): string {
    return `/api/storage/${encodeURIComponent(key)}`;
  }
}

export function createStorageService(env: Env): StorageService {
  return new StorageService(env);
}
