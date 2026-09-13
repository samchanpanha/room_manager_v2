/// S3-compatible object storage backend (SigV4) using aws4fetch.
/// Selectable by setting S3_BUCKET + S3_ACCESS_KEY_ID + S3_SECRET_ACCESS_KEY
/// (optional S3_REGION, default us-east-1; custom providers set S3_ENDPOINT,
/// e.g. http://minio:9000 — path-style). Without those, the app falls back
/// to the dev-disk driver.
import { AwsClient } from "aws4fetch";
import type { StorageBackend } from ".";

export interface S3Config {
  bucket: string;
  accessKeyId: string;
  secretAccessKey: string;
  region: string;
  /// Custom S3-compatible endpoint (MinIO, R2, Wasabi, ...). Required for
  /// non-AWS providers — when unset the driver uses the AWS virtual-hosted
  /// address (https://s3.<region>.amazonaws.com/<bucket>/<key>).
  endpoint?: string;
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
    region: process.env.S3_REGION?.trim() || "us-east-1",
    endpoint: process.env.S3_ENDPOINT?.trim() || undefined
  };
}

export class S3Storage implements StorageBackend {
  private client: AwsClient;

  constructor(private config: S3Config) {
    this.client = new AwsClient({
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey,
      region: config.region,
      // Enforce an S3 signing scope. Without an explicit `service`, aws4fetch
      // defaults to "execute-api" and MinIO rejects the signature (400).
      service: "s3"
    });
  }

  private objectUrl(key: string): string {
    const k = key.replace(/^\/+/, "");
    if (this.config.endpoint) {
      // Custom provider (MinIO et al.) → path-style: <endpoint>/<bucket>/<key>
      const base = this.config.endpoint.replace(/\/+$/, "");
      return `${base}/${this.config.bucket}/${k}`;
    }
    return `https://s3.${this.config.region}.amazonaws.com/${this.config.bucket}/${k}`;
  }

  private async ensure(res: Response, action: string, key: string): Promise<void> {
    if (!res.ok) throw new Error(`S3 ${action} "${key}" failed: ${res.status} ${res.statusText}`);
  }

  async put(key: string, body: Buffer, contentType?: string): Promise<void> {
    // Sign the PUT with aws4fetch, then send the payload as a plain Buffer via
    // the platform fetch: undici frames it with a Content-Length, which MinIO
    // requires (aws4fetch's own fetch sends the body streamed, and inside the
    // Next.js server runtime that reaches MinIO as `411 Length Required`).
    const signed = await this.client.sign(this.objectUrl(key), {
      method: "PUT",
      headers: { "Content-Type": contentType ?? "application/octet-stream" },
      body
    });
    const res = await fetch(signed.url, {
      method: signed.method,
      headers: signed.headers,
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