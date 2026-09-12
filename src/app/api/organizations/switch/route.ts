import { fail, ok, parseBody, clientIp } from "@/lib/api";
import { getAuthUser } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { logAudit } from "@/lib/audit";
import { z } from "zod";

const switchSchema = z.object({
  tenantId: z.string().min(1, "Tenant ID is required")
});

/// POST /api/organizations/switch
/// Allows SUPER_ADMIN to switch active organization context
export async function POST(req: Request) {
  const ip = clientIp(req);
  const user = await getAuthUser();
  if (!user) return fail(401, "UNAUTHENTICATED", "Sign in required");

  // Strict tenant scoping: only Platform Root (DEFAULT workspace SUPER_ADMIN) can switch organization context
  const isPlatformRoot = user.tenantId === "DEFAULT" && user.roles.includes("SUPER_ADMIN");
  if (!isPlatformRoot) {
    return fail(403, "FORBIDDEN", "Only Platform Super Administrators can switch organization context");
  }

  const parsed = await parseBody(req, switchSchema);
  if (parsed.response) return parsed.response;

  const targetTenant = await prisma.tenant.findUnique({
    where: { id: parsed.data.tenantId }
  });
  if (!targetTenant) {
    return fail(404, "NOT_FOUND", "Target organization not found");
  }

  // Update user's tenantId
  await prisma.user.update({
    where: { id: user.id },
    data: { tenantId: targetTenant.id }
  });

  await logAudit({
    tenantId: targetTenant.id,
    actorId: user.id,
    actorName: user.name,
    module: "M01",
    action: "update",
    entityType: "user",
    entityId: user.id,
    summary: `Switched active organization to ${targetTenant.name} (${targetTenant.slug})`,
    after: { tenantId: targetTenant.id, tenantName: targetTenant.name },
    ip
  });

  return ok({
    switched: true,
    tenant: {
      id: targetTenant.id,
      name: targetTenant.name,
      slug: targetTenant.slug
    }
  });
}
