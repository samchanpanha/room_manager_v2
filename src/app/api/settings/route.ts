import { fail, ok, parseBody, clientIp } from "@/lib/api";
import { getAuthUser } from "@/lib/auth/session";
import { getSettings, updateSettings, type SettingsGroupName } from "@/lib/settings";
import { hasModuleAccess } from "@/lib/rbac/can";
import { z } from "zod";

const patchSchema = z.object({
  // Every SettingsGroupName is accepted — the enum previously omitted `table`
  // and `alerts`, so saving those two cards 400'd on a valid request.
  group: z.enum(["org", "locale", "billing", "lateFee", "retention", "features", "reports", "templates", "printer", "telegram", "menu", "units", "table", "alerts", "paymentGateway"]),
  patch: z.record(z.string(), z.unknown()),
  tenantId: z.string().optional()
});

/// §M28 settings: ADMIN M (write), PM/ACC R (read) per §5. Every change is
/// audited inside updateSettings; financial groups are M28:update-only.
/// Settings are scoped per organization workspace (tenantId).
export async function GET(req: Request) {
  const user = await getAuthUser();
  if (!user) return fail(401, "UNAUTHENTICATED", "Sign in required");
  if (!hasModuleAccess(user, "read", "M28")) return fail(403, "FORBIDDEN", "Missing permission M28:read");

  const url = new URL(req.url);
  const reqTenantId = url.searchParams.get("tenantId");

  // Only Super Admins can query settings for other organization workspaces
  const isSuperAdmin = user.roles.includes("SUPER_ADMIN") || user.tenantId === "DEFAULT";
  const targetTenantId = isSuperAdmin && reqTenantId ? reqTenantId : user.tenantId;

  return ok({
    settings: await getSettings(targetTenantId),
    tenantId: targetTenantId
  });
}

export async function PATCH(req: Request) {
  const ip = clientIp(req);
  const user = await getAuthUser();
  if (!user) return fail(401, "UNAUTHENTICATED", "Sign in required");
  if (!hasModuleAccess(user, "update", "M28")) return fail(403, "FORBIDDEN", "Missing permission M28:update");
  const parsed = await parseBody(req, patchSchema);
  if (parsed.response) return parsed.response;

  const isSuperAdmin = user.roles.includes("SUPER_ADMIN") || user.tenantId === "DEFAULT";
  const targetTenantId = isSuperAdmin && parsed.data.tenantId ? parsed.data.tenantId : user.tenantId;

  try {
    await updateSettings(
      parsed.data.group as SettingsGroupName,
      parsed.data.patch,
      { id: user.id, name: user.name },
      ip,
      targetTenantId
    );
  } catch (e) {
    return fail(400, "INVALID_SETTINGS", e instanceof Error ? e.message : "Invalid settings update");
  }
  return ok({
    settings: await getSettings(targetTenantId),
    tenantId: targetTenantId
  });
}
