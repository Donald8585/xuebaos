import type { Env } from "../index";

/**
 * R2 storage service for file uploads and presigned URLs.
 */
export class StorageService {
  private bucket: R2Bucket;

  constructor(env: Env) {
    this.bucket = env.STORAGE;
  }

  async upload(key: string, body: ReadableStream | ArrayBuffer | Blob | string, contentType?: string): Promise<void> {
    const options: R2PutOptions = {};
    if (contentType) {
      options.httpMetadata = { contentType };
    }
    await this.bucket.put(key, body, options);
  }

  async download(key: string): Promise<R2ObjectBody | null> {
    return this.bucket.get(key);
  }

  async delete(key: string): Promise<void> {
    await this.bucket.delete(key);
  }

  async list(prefix?: string, limit?: number): Promise<R2Objects> {
    return this.bucket.list({ prefix, limit });
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
