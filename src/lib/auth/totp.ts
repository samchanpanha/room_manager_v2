/// RFC-6238 TOTP (M27): HMAC-SHA1, 30-second step, 6 digits, ±1 step window.
/// Hand-rolled on node:crypto (no dependency); tested against RFC vectors.
/// Secrets are base32 (RFC-4648, no padding) so they paste into authenticator apps.
import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

const B32 = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

export function base32Encode(buf: Buffer): string {
  let bits = 0;
  let value = 0;
  let out = "";
  for (const byte of buf) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      out += B32[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) out += B32[(value << (5 - bits)) & 31];
  return out;
}

export function base32Decode(input: string): Buffer {
  const clean = input.toUpperCase().replace(/=+$/, "").replace(/\s+/g, "");
  let bits = 0;
  let value = 0;
  const bytes: number[] = [];
  for (const ch of clean) {
    const idx = B32.indexOf(ch);
    if (idx === -1) throw new Error("INVALID_BASE32");
    value = (value << 5) | idx;
    bits += 5;
    if (bits >= 8) {
      bytes.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  return Buffer.from(bytes);
}

export function generateTotpSecret(): string {
  return base32Encode(randomBytes(20));
}

function hotp(secret: Buffer, counter: number): string {
  const buf = Buffer.alloc(8);
  buf.writeBigUInt64BE(BigInt(counter));
  const mac = createHmac("sha1", secret).update(buf).digest();
  const offset = mac[mac.length - 1]! & 0x0f;
  const bin =
    ((mac[offset]! & 0x7f) << 24) | ((mac[offset + 1]!) << 16) | ((mac[offset + 2]!) << 8) | mac[offset + 3]!;
  return String(bin % 1_000_000).padStart(6, "0");
}

function stepAt(timeMs: number, stepSeconds: number): number {
  return Math.floor(timeMs / 1000 / stepSeconds);
}

/// Verify a code against the current time with a ±`window` step clock skew
/// allowance. Constant-time comparison per candidate step.
export function verifyTotp(secretBase32: string, code: string, opts?: { atMs?: number; window?: number }): boolean {
  if (!/^\d{6}$/.test(code)) return false;
  let secret: Buffer;
  try {
    secret = base32Decode(secretBase32);
  } catch {
    return false;
  }
  const at = opts?.atMs ?? Date.now();
  const window = opts?.window ?? 1;
  const counter = stepAt(at, 30);
  for (let drift = -window; drift <= window; drift++) {
    if (counter + drift < 0) continue; // pre-epoch counters don't exist
    const expected = Buffer.from(hotp(secret, counter + drift));
    const provided = Buffer.from(code);
    if (expected.length === provided.length && timingSafeEqual(expected, provided)) return true;
  }
  return false;
}

/// otpauth:// URI for authenticator apps (QR-rendered by the setup UI).
export function otpauthUri(secretBase32: string, account: string, issuer = "RentManager"): string {
  const label = encodeURIComponent(`${issuer}:${account}`);
  const params = new URLSearchParams({ secret: secretBase32, issuer, algorithm: "SHA1", digits: "6", period: "30" });
  return `otpauth://totp/${label}?${params.toString()}`;
}
