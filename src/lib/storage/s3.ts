/// S3-compatible object storage backend (SigV4) using aws4fetch.
/// Selectable by setting S3_BUCKET + S3_ACCESS_KEY_ID + S3_SECRET_ACCESS_KEY
/// (+ optional S3_REGION, default us-east-1). Without those, the app falls
/// back to the dev-disk driver.
import { AwsClient } from "aws4fetch";
import type { StorageBackend } from ".";

export interface S3Config {
  bucket: string;
  accessKeyId: string;
  secretAccessKey: string;
  region: string;
}

export function s3ConfigFromEnv(): S3Config | null {
  const bucket = process.env.S3_BUCKET?.trim() || "";
  const accessKeyId = process.env.S3_ACCESS_KEY_ID?.trim() || "";
  const secretAccessKey = process.env.S3_SECRET_ACCESS_KEY?.trim() || "";
  if (!bucket || !accessKeyId || !secretAccessKey) return null;
  return {
    bucket,
    accessKeyId,
    secretAccessKey,
    region: process.env.S3_REGION?.trim() || "us-east-1"
  };
}

export class S3Storage implements StorageBackend {
  private client: AwsClient;

  constructor(private config: S3Config) {
    this.client = new AwsClient({
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey,
      region: config.region
    });
  }

  private objectUrl(key: string): string {
    const k = key.replace(/^\/+/, "");
    return `https://s3.${this.config.region}.amazonaws.com/${this.config.bucket}/${k}`;
  }

  private async ensure(res: Response, action: string, key: string): Promise<void> {
    if (!res.ok) throw new Error(`S3 ${action} "${key}" failed: ${res.status} ${res.statusText}`);
  }

  async put(key: string, body: Buffer, contentType?: string): Promise<void> {
    const res = await this.client.fetch(this.objectUrl(key), {
      method: "PUT",
      headers: { "Content-Type": contentType ?? "application/octet-stream" },
      body
    });
    await this.ensure(res, "PUT", key);
  }

  async get(key: string): Promise<Buffer> {
    const res = await this.client.fetch(this.objectUrl(key), { method: "GET" });
    if (!res.ok) throw new Error(`S3 GET "${key}" failed: ${res.status} ${res.statusText}`);
    return Buffer.from(await res.arrayBuffer());
  }

  async remove(key: string): Promise<void> {
    const res = await this.client.fetch(this.objectUrl(key), { method: "DELETE" });
    if (!res.ok && res.status !== 404) await this.ensure(res, "DELETE", key);
  }

  /// Presign a browser-safe GET (query auth), e.g. for the M17 signed-URL flow.
  async signedUrl(key: string, ttlSeconds: number): Promise<string> {
    const url = new URL(this.objectUrl(key));
    url.searchParams.set("X-Amz-Expires", String(ttlSeconds));
    const signed = await this.client.sign(url.toString(), {
      method: "GET",
      aws: { signQuery: true }
    });
    return signed.url;
  }
}