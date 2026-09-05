/// §M17 object-storage facade. Routes/services only ever talk to `storage`
/// (put/get/remove). Two backends: a local disk store (default, zero-config
/// dev fallback) and S3-compatible object storage selected via env vars.
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { S3Storage, s3ConfigFromEnv } from "./s3";

export interface StorageBackend {
  put(key: string, body: Buffer, contentType?: string): Promise<void>;
  get(key: string): Promise<Buffer>;
  remove(key: string): Promise<void>;
}

export const MAX_UPLOAD_BYTES = 25 * 1024 * 1024;

export const ALLOWED_MIME = new Set(["application/pdf", "image/png", "image/jpeg", "image/webp"]);

export function isAllowedMime(mime: string): boolean {
  return ALLOWED_MIME.has(mime);
}

export class DevDiskStorage implements StorageBackend {
  private dir = process.env.STORAGE_DIR ?? path.join(process.cwd(), ".storage");

  private objectPath(key: string): string {
    return path.join(this.dir, key.replace(/^\/+/, ""));
  }

  async put(key: string, body: Buffer): Promise<void> {
    const target = this.objectPath(key);
    await mkdir(path.dirname(target), { recursive: true });
    await writeFile(target, body);
  }

  async get(key: string): Promise<Buffer> {
    return readFile(this.objectPath(key));
  }

  async remove(key: string): Promise<void> {
    await rm(this.objectPath(key), { force: true });
  }
}

export function activeStorageDriver(): "s3" | "dev disk" {
  return s3ConfigFromEnv() ? "s3" : "dev disk";
}

function activeBackend(): StorageBackend {
  const s3 = s3ConfigFromEnv();
  return s3 ? new S3Storage(s3) : new DevDiskStorage();
}

/// Lazy singleton so env-driven configuration is read only when first used.
export const storage: StorageBackend = {
  put: (key, body, contentType) => activeBackend().put(key, body, contentType),
  get: (key) => activeBackend().get(key),
  remove: (key) => activeBackend().remove(key)
};