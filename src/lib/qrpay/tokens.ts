/// M13 static/member QR tokens — stateless HMAC-signed references so a
/// printed poster or invoice QR lets a member pay without logging in
/// (§M13 "pay-without-login via member QR scan"). The token carries the
/// memberProfileId; the /pay page and its endpoints resolve it server-side.
import { createHmac, timingSafeEqual } from "crypto";
import { env } from "@/lib/env";
import QRCode from "qrcode";

function key(): string {
  return `qrpay:${env.PAYMENT_WEBHOOK_SECRET}`;
}

export function signMemberToken(memberProfileId: string): string {
  const mac = createHmac("sha256", key()).update(`member:${memberProfileId}`).digest("base64url");
  return `${memberProfileId}.${mac}`;
}

export function verifyMemberToken(token: string): string | null {
  const dot = token.lastIndexOf(".");
  if (dot <= 0) return null;
  const memberProfileId = token.slice(0, dot);
  const mac = Buffer.from(token.slice(dot + 1));
  const expected = Buffer.from(createHmac("sha256", key()).update(`member:${memberProfileId}`).digest("base64url"));
  if (mac.length !== expected.length || !timingSafeEqual(mac, expected)) return null;
  return memberProfileId;
}

/// Render the member's pay QR (encodes the absolute /pay URL) as a data URL.
export async function memberPayQrDataUrl(baseUrl: string, memberProfileId: string): Promise<string> {
  const token = signMemberToken(memberProfileId);
  const url = `${baseUrl.replace(/\/$/, "")}/pay?m=${encodeURIComponent(token)}`;
  return QRCode.toDataURL(url, { margin: 1, width: 240 });
}
