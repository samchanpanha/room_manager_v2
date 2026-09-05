/// M17 signed download tokens (HMAC-SHA256 over a base64url JSON body).
/// The token is the credential for /api/files/:token — no session required,
/// bound to a document id, expires after `exp`. Replaces presigned S3 URLs
/// so the object backend stays interchangeable (disk or S3).
import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

export const SIGNED_URL_TTL_SECONDS = 120;

const SECRET = process.env.DOCUMENT_SIGNING_SECRET ?? "dev-document-signing-secret";

interface TokenPayload {
  docId: string;
  exp: number;
  nonce: string;
}

function sign(body: string): string {
  return createHmac("sha256", SECRET).update(body).digest("base64url");
}

/// Issue a token for `docId` valid for `ttlSeconds` (default SIGNED_URL_TTL_SECONDS).
/// Includes a random nonce so identical inputs never produce the same token.
export function signDownloadToken(docId: string, ttlSeconds: number = SIGNED_URL_TTL_SECONDS): string {
  const payload: TokenPayload = { docId, exp: Date.now() + ttlSeconds * 1000, nonce: randomBytes(8).toString("hex") };
  const body = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
  return `${body}.${sign(body)}`;
}

/// Verify a token: length, signature (constant-time), JSON shape, expiry.
/// Returns `{ docId }` on success or `null` on any tampering/expiry.
export function verifyDownloadToken(token: string): { docId: string } | null {
  const idx = token.lastIndexOf(".");
  if (idx < 1) return null;
  const body = token.slice(0, idx);
  const sig = token.slice(idx + 1);
  const expected = sign(body);
  if (sig.length !== expected.length) return null;
  if (!timingSafeEqual(Buffer.from(sig, "ascii"), Buffer.from(expected, "ascii"))) return null;

  let payload: TokenPayload;
  try {
    payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8"));
  } catch {
    return null;
  }
  if (typeof payload?.docId !== "string" || typeof payload?.exp !== "number") return null;
  if (payload.exp <= Date.now()) return null;
  return { docId: payload.docId };
}