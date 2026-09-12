import { fail, ok, parseBody, clientIp } from "@/lib/api";
import { getAuthUser } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { hasModuleAccess } from "@/lib/rbac/can";
import { logAudit } from "@/lib/audit";
import { z } from "zod";

const patchOrgSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters").optional(),
  contactEmail: z.string().email().optional().nullable(),
  status: z.enum(["active", "suspended", "disabled"]).optional()
});

/// GET /api/organizations/[id]
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getAuthUser();
  if (!user) return fail(401, "UNAUTHENTICATED", "Sign in required");

  // Strict tenant scoping: only Platform Root super-admin can view any organization; tenant admins can only view their own
  const isPlatformRoot = user.tenantId === "DEFAULT" && user.roles.includes("SUPER_ADMIN");
  if (!isPlatformRoot && user.tenantId !== id) {
    return fail(403, "FORBIDDEN", "You do not have permission to view another organization");
  }

  const tenant = await prisma.tenant.findUnique({
    where: { id },
    include: {
      _count: {
        select: {
          users: true,
          properties: true,
          parties: true
        }
      },
      properties: {
        select: { id: true, name: true, code: true, status: true }
      },
      users: {
        select: { id: true, name: true, email: true, status: true }
      }
    }
  });

  if (!tenant) return fail(404, "NOT_FOUND", "Organization not found");

  return ok({ tenant });
}

/// PATCH /api/organizations/[id]
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ip = clientIp(req);
  const user = await getAuthUser();
  if (!user) return fail(401, "UNAUTHENTICATED", "Sign in required");

  // Strict tenant scoping: only Platform Root or this organization's own Admin/Owner can update it
  const isPlatformRoot = user.tenantId === "DEFAULT" && user.roles.includes("SUPER_ADMIN");
  const isOrgAdmin = user.tenantId === id && (user.roles.includes("ADMIN") || user.roles.includes("SUPER_ADMIN") || hasModuleAccess(user, "update", "M28"));

  if (!isPlatformRoot && !isOrgAdmin) {
    return fail(403, "FORBIDDEN", "You do not have permission to modify this organization");
  }

  const parsed = await parseBody(req, patchOrgSchema);
  if (parsed.response) return parsed.response;

  const existing = await prisma.tenant.findUnique({
    where: { id }
  });
  if (!existing) return fail(404, "NOT_FOUND", "Organization not found");

  const updated = await prisma.tenant.update({
    where: { id },
    data: {
      name: parsed.data.name?.trim() ?? existing.name,
      contactEmail: parsed.data.contactEmail !== undefined ? (parsed.data.contactEmail?.trim().toLowerCase() || null) : existing.contactEmail,
      status: parsed.data.status ?? existing.status
    }
  });

  await logAudit({
    tenantId: id,
    actorId: user.id,
    actorName: user.name,
    module: "M01",
    action: "update",
    entityType: "tenant",
    entityId: id,
    summary: `Updated organization ${updated.name} (${updated.slug})`,
    before: { name: existing.name, contactEmail: existing.contactEmail, status: existing.status },
    after: { name: updated.name, contactEmail: updated.contactEmail, status: updated.status },
    ip
  });

  return ok({ tenant: updated });
}
