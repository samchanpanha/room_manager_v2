/// M25 Tenant Portal — OTP login (§M25 "mobile-first web/PWA, OTP login").
/// Members have no password: an identifier (party email or phone) receives a
/// 6-digit code; verification materializes the member's User (role MEMBER,
/// unusable random password) so every capability maps onto the normal M01
/// session + RBDC stack. Codes are stored hashed, single-use, max 5 attempts,
/// 10-minute TTL. Delivery v1 = dev echo (no mail/SMS provider until M21/M28).
import { createHash, randomBytes, randomInt } from "node:crypto";
import { prisma } from "@/lib/db";
import { hashPassword } from "@/lib/auth/password";
import { logAudit } from "@/lib/audit";

export const OTP_TTL_MS = 10 * 60 * 1000;
export const OTP_MAX_ATTEMPTS = 5;

const sha256 = (input: string) => createHash("sha256").update(input).digest("hex");
const digitsOnly = (s: string) => s.replace(/\D+/g, "");

export interface OtpRequestResult {
  ok: true;
  /// false = identifier unknown — the response stays generic (no enumeration).
  delivered: boolean;
  /// Dev/demo only (NODE_ENV !== "production"): the code so the journey is
  /// testable without a mail/SMS provider. Never set in production builds.
  devCode?: string;
}

function normalizeIdentifier(raw: string): string {
  return raw.trim().toLowerCase();
}

async function findMemberByIdentifier(raw: string) {
  const identifier = normalizeIdentifier(raw);
  const byEmail = await prisma.memberProfile.findFirst({
    where: { party: { email: { equals: identifier } } },
    include: { party: true }
  });
  if (byEmail) return byEmail;
  const phoneDigits = digitsOnly(raw);
  if (phoneDigits.length < 6) return null;
  const candidates = await prisma.memberProfile.findMany({
    where: { party: { phone: { not: null } } },
    include: { party: true }
  });
  return candidates.find((m) => digitsOnly(m.party.phone ?? "") === phoneDigits) ?? null;
}

/// Issue an OTP for a member identifier. Always ok:true — unknown identifiers
/// are indistinguishable from known ones in the API response (§M27 PII).
export async function requestMemberOtp(rawIdentifier: string, ip?: string | null): Promise<OtpRequestResult> {
  const identifier = normalizeIdentifier(rawIdentifier);
  const member = await findMemberByIdentifier(rawIdentifier);
  if (!member) return { ok: true, delivered: false };

  const code = String(randomInt(0, 1_000_000)).padStart(6, "0");
  await prisma.memberOtp.updateMany({
    where: { identifier, consumedAt: null },
    data: { consumedAt: new Date() } // supersede earlier codes
  });
  await prisma.memberOtp.create({
    data: {
      identifier,
      channel: member.party.email ? "email" : "sms",
      codeHash: sha256(code),
      memberProfileId: member.id,
      expiresAt: new Date(Date.now() + OTP_TTL_MS),
      requestedIp: ip ?? null
    }
  });
  if (process.env.NODE_ENV !== "production") {
    console.log(`[portal-otp] ${identifier} → ${code} (dev echo — delivery provider lands with M21/M28)`);
  }
  return {
    ok: true,
    delivered: true,
    ...(process.env.NODE_ENV !== "production" ? { devCode: code } : {})
  };
}

export type OtpVerifyResult =
  | { ok: true; userId: string; memberName: string }
  | { ok: false; code: "INVALID_CODE" | "LOCKED"; message: string };

/// Materialize the member's portal User: one per party, role MEMBER, a random
/// password (password login stays impossible — OTP is the only front door).
export async function ensureMemberUser(memberProfileId: string) {
  const member = await prisma.memberProfile.findUniqueOrThrow({ where: { id: memberProfileId }, include: { party: true } });
  const existing = await prisma.user.findFirst({ where: { partyId: member.partyId } });
  if (existing) return existing;

  const role = await prisma.role.findUniqueOrThrow({ where: { key: "MEMBER" } });
  const preferred = member.party.email ?? `${member.id}@portal.internal`;
  const email = (await prisma.user.findUnique({ where: { email: preferred }, select: { id: true } }))
    ? `${member.id}@portal.internal`
    : preferred;
  return prisma.user.create({
    data: {
      email,
      name: member.party.name,
      passwordHash: hashPassword(randomBytes(16).toString("hex")),
      partyId: member.partyId,
      roles: { create: { roleId: role.id } }
    }
  });
}

export async function verifyMemberOtp(rawIdentifier: string, rawCode: string): Promise<OtpVerifyResult> {
  const identifier = normalizeIdentifier(rawIdentifier);
  const code = rawCode.trim();
  const otp = await prisma.memberOtp.findFirst({
    where: { identifier, consumedAt: null },
    orderBy: { createdAt: "desc" }
  });
  if (!otp || otp.expiresAt < new Date()) {
    return { ok: false, code: "INVALID_CODE", message: "This code is not valid or has expired" };
  }
  if (otp.attempts >= OTP_MAX_ATTEMPTS) {
    return { ok: false, code: "LOCKED", message: "Too many attempts — request a new code" };
  }
  if (otp.codeHash !== sha256(code)) {
    const attempts = otp.attempts + 1;
    // The row stays (expired TTL eventually prunes it) so later verifies get
    // an honest LOCKED rather than a generic invalid-code answer.
    await prisma.memberOtp.update({
      where: { id: otp.id },
      data: { attempts }
    });
    return attempts >= OTP_MAX_ATTEMPTS
      ? { ok: false, code: "LOCKED", message: "Too many attempts — request a new code" }
      : { ok: false, code: "INVALID_CODE", message: "This code is not valid or has expired" };
  }

  await prisma.memberOtp.update({ where: { id: otp.id }, data: { consumedAt: new Date() } });
  const user = await ensureMemberUser(otp.memberProfileId);
  await logAudit({
    actorId: user.id,
    actorName: user.name,
    module: "M25",
    action: "login",
    entityType: "member_otp",
    entityId: otp.id,
    summary: `Tenant portal OTP login (${otp.identifier.replace(/(.{2}).*(@.*)/, "$1***$2")})`,
    ip: otp.requestedIp
  });
  return { ok: true, userId: user.id, memberName: user.name };
}
