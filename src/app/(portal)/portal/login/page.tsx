import { redirect } from "next/navigation";
import { getAuthUser } from "@/lib/auth/session";
import { hasModuleAccess } from "@/lib/rbac/can";
import { LoginForm } from "./login-form";

/// §M25 login — public page; signed-in M25 readers go straight to the portal.
export default async function PortalLoginPage() {
  const user = await getAuthUser();
  if (user && hasModuleAccess(user, "read", "M25")) {
    const linked = user.partyId
      ? await (await import("@/lib/db")).prisma.memberProfile.findUnique({ where: { partyId: user.partyId }, select: { id: true } })
      : null;
    if (linked) redirect("/portal");
  }
  return <LoginForm />;
}
