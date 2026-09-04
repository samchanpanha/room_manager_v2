import { getAuthUser } from "@/lib/auth/session";
import { hasModuleAccess } from "@/lib/rbac/can";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { PageHeader } from "@/components/ui/misc";
import { SecurityPanel } from "./security-panel";

export const dynamic = "force-dynamic";

/// §M27 security console: TOTP 2FA (mandatory for Admin+), sessions & devices
/// with revoke, tamper-evidence verification. ADMIN = M(audit) scope (§15 v1.4c).
export default async function SecurityPage() {
  const user = await getAuthUser();
  if (!user) redirect("/login");
  if (!hasModuleAccess(user, "read", "M27")) redirect("/dashboard");

  const sessions = await prisma.session.findMany({
    where: { userId: user.id, expiresAt: { gt: new Date() } },
    orderBy: { createdAt: "desc" },
    select: { id: true, userAgent: true, ip: true, createdAt: true, revokedAt: true }
  });

  const [totpState, admins] = await Promise.all([
    prisma.user.findUniqueOrThrow({ where: { id: user.id }, select: { totpEnabled: true, totpSecret: true } }),
    user.isSuperAdmin
      ? prisma.user.findMany({
          where: { roles: { some: { role: { key: { in: ["SUPER_ADMIN", "ADMIN"] } } } }, totpEnabled: true },
          select: { id: true, name: true, email: true }
        })
      : Promise.resolve([])
  ]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Security"
        description="Two-factor authentication, devices & sessions, audit tamper-evidence (§M27)."
      />
      <SecurityPanel
        email={user.email}
        totpEnabled={totpState.totpEnabled}
        enrollmentStarted={totpState.totpSecret !== null}
        enrollmentRequired={user.totpEnrollmentRequired}
        isAdmin={user.roles.some((r) => r === "SUPER_ADMIN" || r === "ADMIN")}
        isSuperAdmin={user.isSuperAdmin}
        sessions={sessions.map((s) => ({ ...s, current: s.id === user.sessionId }))}
        adminsWithTotp={admins}
      />
    </div>
  );
}
