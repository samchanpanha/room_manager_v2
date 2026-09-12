import { redirect } from "next/navigation";
import { getAuthUser } from "@/lib/auth/session";
import { hasModuleAccess } from "@/lib/rbac/can";
import { getFeatureFlags, getSettings } from "@/lib/settings";
import { setActiveCurrency } from "@/lib/money";
import { MODULES } from "@/lib/rbac/catalog";
import { Shell } from "@/components/shell";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await getAuthUser();
  if (!user) redirect("/login");

  // M34: an admin-set default/temporary password is still active — the only
  // page the user may reach is the forced change screen on /account/password.
  if (user.mustChangePassword) redirect("/account/password?force=1");

  const moduleAllowed: Record<string, boolean> = {};
  const [flags, settings] = await Promise.all([getFeatureFlags(user.tenantId), getSettings(user.tenantId)]);
  setActiveCurrency(settings.locale.currency); // §M28 org-wide display currency
  for (const m of MODULES) {
    // Super Admins & Org Owners have full access to all modules and menus
    const hasAccess = hasModuleAccess(user, "read", m.key);
    moduleAllowed[m.key] = user.isSuperAdmin ? true : (hasAccess && flags[m.key] !== false);
  }
  moduleAllowed["OWNER_PORTAL"] = user.roles.includes("OWNER") || user.isSuperAdmin;

  return (
    <Shell
      user={{ name: user.name, email: user.email, roles: user.roles }}
      moduleAllowed={moduleAllowed}
      org={{ name: user.tenantName || settings.org.name, legalName: settings.org.legalName, logo: settings.org.logo }}
      menu={{ side: settings.menu.side }}
    >
      {children}
    </Shell>
  );
}
