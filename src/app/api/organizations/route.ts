import { fail, ok, parseBody, clientIp } from "@/lib/api";
import { getAuthUser } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { hasModuleAccess } from "@/lib/rbac/can";
import { logAudit } from "@/lib/audit";
import { sanitizeSlug, RESERVED_SLUGS } from "@/lib/tenant-shared";
import { z } from "zod";

import { registerTenant } from "@/lib/tenant";

const createOrgSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  slug: z.string().min(2, "Slug must be at least 2 characters"),
  contactEmail: z.string().email().optional().nullable(),
  adminName: z.string().min(2).optional(),
  adminEmail: z.string().email().optional(),
  password: z.string().min(6).optional(),
  initialPropertyName: z.string().optional()
});

/// GET /api/organizations
/// List organizations: returns all organizations for Platform Root super-admin, or strictly the current user's organization.
export async function GET() {
  const user = await getAuthUser();
  if (!user) return fail(401, "UNAUTHENTICATED", "Sign in required");

  // Strict tenant scoping: only Platform Root (DEFAULT workspace SUPER_ADMIN) can view all organizations.
  // All tenant owners/admins are strictly isolated to their own organization!
  const isPlatformRoot = user.tenantId === "DEFAULT" && user.roles.includes("SUPER_ADMIN");
  const where = isPlatformRoot ? {} : { id: user.tenantId };

  const tenants = await prisma.tenant.findMany({
    where,
    include: {
      _count: {
        select: {
          users: true,
          properties: true,
          parties: true
        }
      },
      properties: {
        take: 5,
        select: { id: true, name: true, code: true, status: true }
      }
    },
    orderBy: { createdAt: "desc" }
  });

  return ok({
    tenants: tenants.map((t) => ({
      id: t.id,
      name: t.name,
      slug: t.slug,
      contactEmail: t.contactEmail,
      status: t.status,
      createdAt: t.createdAt.toISOString(),
      updatedAt: t.updatedAt.toISOString(),
      counts: {
        users: t._count.users,
        properties: t._count.properties,
        parties: t._count.parties
      },
      properties: t.properties,
      isCurrent: t.id === user.tenantId
    })),
    currentTenantId: user.tenantId,
    isPlatformRoot
  });
}

/// POST /api/organizations
/// Create a new organization / tenant workspace with full owner super-admin grants.
export async function POST(req: Request) {
  const ip = clientIp(req);
  const user = await getAuthUser();
  if (!user) return fail(401, "UNAUTHENTICATED", "Sign in required");

  // Creating an organization directly requires SUPER_ADMIN or Admin role
  if (!user.roles.includes("SUPER_ADMIN") && !hasModuleAccess(user, "create", "M01")) {
    return fail(403, "FORBIDDEN", "Only administrators can create organizations");
  }

  const parsed = await parseBody(req, createOrgSchema);
  if (parsed.response) return parsed.response;

  // If admin credentials are provided, perform complete registration with Owner Super Admin
  if (parsed.data.adminEmail && parsed.data.password) {
    try {
      const reg = await registerTenant({
        companyName: parsed.data.name.trim(),
        slug: parsed.data.slug.trim(),
        adminName: parsed.data.adminName?.trim() || user.name,
        adminEmail: parsed.data.adminEmail.trim(),
        password: parsed.data.password,
        initialPropertyName: parsed.data.initialPropertyName?.trim(),
        ip
      });
      return ok({ tenant: reg.tenant, user: reg.user, property: reg.property }, 201);
    } catch (e) {
      return fail(400, "REGISTRATION_FAILED", e instanceof Error ? e.message : "Failed to register organization");
    }
  }

  const cleanSlug = sanitizeSlug(parsed.data.slug);
  if (!cleanSlug || cleanSlug.length < 2) {
    return fail(400, "INVALID_SLUG", "Invalid organization slug");
  }
  if (RESERVED_SLUGS.has(cleanSlug)) {
    return fail(400, "RESERVED_SLUG", "This organization slug is reserved");
  }

  const existingSlug = await prisma.tenant.findUnique({
    where: { slug: cleanSlug }
  });
  if (existingSlug) {
    return fail(409, "DUPLICATE_SLUG", "An organization with this slug already exists");
  }

  const tenant = await prisma.tenant.create({
    data: {
      name: parsed.data.name.trim(),
      slug: cleanSlug,
      contactEmail: parsed.data.contactEmail?.trim().toLowerCase() || null,
      status: "active"
    }
  });

  await logAudit({
    tenantId: tenant.id,
    actorId: user.id,
    actorName: user.name,
    module: "M01",
    action: "create",
    entityType: "tenant",
    entityId: tenant.id,
    summary: `Created organization ${tenant.name} (${tenant.slug})`,
    after: { id: tenant.id, name: tenant.name, slug: tenant.slug },
    ip
  });

  return ok({ tenant }, 201);
}
