import { createHash, randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { prisma } from "@/lib/db";
import { env } from "@/lib/env";
import type { EffectivePermission, Subject } from "@/lib/rbac/can";
import { unionPermissions } from "@/lib/rbac/can";
import type { Action } from "@/lib/rbac/catalog";

export const SESSION_COOKIE = "rm_session";

export interface AuthUser extends Subject {
  name: string;
  email: string;
  partyId: string | null;
  roles: string[];
  sessionId: string;
  isSuperAdmin: boolean;
  totpEnrollmentRequired: boolean;
  mustChangePassword: boolean;
}

const ADMIN_PLUS_ROLES = new Set(["SUPER_ADMIN", "ADMIN"]);

function sha256(input: string): string {
  return createHash("sha256").update(input).digest("hex");
}

/// Create a DB-backed session row and set the httpOnly cookie (route handlers only).
export async function createSession(
  userId: string,
  meta: { userAgent?: string | null; ip?: string | null }
): Promise<void> {
  const token = randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + env.SESSION_TTL_DAYS * 24 * 60 * 60 * 1000);
  await prisma.session.create({
    data: { userId, tokenHash: sha256(token), expiresAt, userAgent: meta.userAgent ?? null, ip: meta.ip ?? null }
  });
  const jar = await cookies();
  jar.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production" && process.env.COOKIE_SECURE !== "false",
    path: "/",
    expires: expiresAt
  });
}

/// Revoke the current session (sessions are revocable — INTENT.md M01).
export async function destroyCurrentSession(): Promise<void> {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (token) {
    await prisma.session.updateMany({
      where: { tokenHash: sha256(token), revokedAt: null },
      data: { revokedAt: new Date() }
    });
  }
  jar.delete(SESSION_COOKIE);
}

/// Resolve the current authenticated user with effective permission union.
export async function getAuthUser(): Promise<AuthUser | null> {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (!token) return null;

  const session = await prisma.session.findUnique({
    where: { tokenHash: sha256(token) },
    include: {
      user: {
        include: {
          roles: { include: { role: { include: { permissions: { include: { permission: true } } } } } },
          assignments: true
        }
      }
    }
  });
  if (!session || session.revokedAt || session.expiresAt < new Date()) return null;
  if (session.user.status !== "active") return null;

  const lists: EffectivePermission[][] = session.user.roles.map((ur) =>
    ur.role.permissions.map((rp) => ({
      module: rp.permission.module,
      action: rp.permission.action as Action,
      scope: rp.scope as EffectivePermission["scope"]
    }))
  );

  const roles = session.user.roles.map((ur) => ur.role.key);
  const isAdminPlus = roles.some((r) => ADMIN_PLUS_ROLES.has(r));
  return {
    id: session.user.id,
    name: session.user.name,
    email: session.user.email,
    partyId: session.user.partyId,
    sessionId: session.id,
    roles,
    propertyIds: session.user.assignments.map((a) => a.propertyId),
    permissions: unionPermissions(...lists),
    isSuperAdmin: roles.includes("SUPER_ADMIN"),
    // §M27: TOTP 2FA is mandatory for Admin+ — until enrolled, only M27
    // capabilities resolve (can()/hasModuleAccess() gate on this flag).
    totpEnrollmentRequired: isAdminPlus && !session.user.totpEnabled,
    // M34: admin-set default/temporary password — user is routed to the
    // forced password-change screen until they set their own.
    mustChangePassword: session.user.mustChangePassword
  };
}
