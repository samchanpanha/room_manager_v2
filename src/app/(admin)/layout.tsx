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

  const moduleAllowed: Record<string, boolean> = {};
  const [flags, settings] = await Promise.all([getFeatureFlags(), getSettings()]);
  setActiveCurrency(settings.locale.currency); // §M28 org-wide display currency
  for (const m of MODULES) {
    // M28 feature flags hide optional modules (POS/Stock/Telegram) org-wide
    moduleAllowed[m.key] = hasModuleAccess(user, "read", m.key) && flags[m.key] !== false;
  }
  moduleAllowed["OWNER_PORTAL"] = user.roles.includes("OWNER");

  return (
    <Shell user={{ name: user.name, email: user.email, roles: user.roles }} moduleAllowed={moduleAllowed}>
      {children}
    </Shell>
  );
}
