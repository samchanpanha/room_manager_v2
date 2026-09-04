/// Authenticated secret sealing (M27/M28): AES-256-GCM under a key derived
/// from SETTINGS_ENC_KEY. Records are `v1.<iv-b64url>.<tag-b64url>.<ct-b64url>`.
/// M28 secret-typed settings (payment credentials, Telegram bot token, TOTP
/// shared secrets) are sealed at rest and only ever returned masked (§15 v1.4b).
import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

function sealingKey(): Buffer {
  const material = process.env.SETTINGS_ENC_KEY ?? "dev-settings-enc-key-change-me-32b-min";
  return createHash("sha256").update(material).digest();
}

export function seal(plaintext: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", sealingKey(), iv);
  const ct = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `v1.${iv.toString("base64url")}.${tag.toString("base64url")}.${ct.toString("base64url")}`;
}

export function open(sealed: string): string | null {
  const parts = sealed.split(".");
  if (parts.length !== 4 || parts[0] !== "v1") return null;
  try {
    const iv = Buffer.from(parts[1]!, "base64url");
    const tag = Buffer.from(parts[2]!, "base64url");
    const ct = Buffer.from(parts[3]!, "base64url");
    const decipher = createDecipheriv("aes-256-gcm", sealingKey(), iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(ct), decipher.final()]).toString("utf8");
  } catch {
    return null; // wrong key or tampered record
  }
}

/// Masked view for API responses: only "configured" + last 4 ever leave the server.
export function maskSecret(sealed: string | null | undefined): { configured: boolean; last4: string | null } {
  if (!sealed) return { configured: false, last4: null };
  const plain = open(sealed);
  return { configured: plain !== null && plain.length > 0, last4: plain ? plain.slice(-4) : null };
}
