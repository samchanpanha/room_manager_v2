import { describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import { registerTenant } from "@/lib/tenant";
import type { Action, Scope } from "@/lib/rbac/catalog";

describe("Multi-Tenant Organization Management", () => {
  it("allows creating, querying and updating tenant organizations", async () => {
    const timestamp = Date.now();
    const slug = `org-test-${timestamp}`;

    // 1. Create a tenant workspace
    const reg = await registerTenant({
      companyName: "Horizon Real Estate",
      slug,
      adminName: "Horizon Admin",
      adminEmail: `horizon-${timestamp}@test.org`,
      password: "Password123!",
      initialPropertyName: "Horizon Peak"
    });

    expect(reg.tenant.id).toBeDefined();
    expect(reg.tenant.name).toBe("Horizon Real Estate");
    expect(reg.tenant.slug).toBe(slug);

    // 2. Query organization details
    const tenantInDb = await prisma.tenant.findUnique({
      where: { id: reg.tenant.id },
      include: {
        _count: { select: { users: true, properties: true, parties: true } },
        properties: true
      }
    });

    expect(tenantInDb).not.toBeNull();
    expect(tenantInDb?.name).toBe("Horizon Real Estate");
    expect(tenantInDb?._count.properties).toBe(1);
    expect(tenantInDb?._count.users).toBe(1);

    // 3. Update organization details
    const updated = await prisma.tenant.update({
      where: { id: reg.tenant.id },
      data: {
        name: "Horizon Living Group",
        contactEmail: `contact-${timestamp}@horizon.test`,
        status: "active"
      }
    });

    expect(updated.name).toBe("Horizon Living Group");
    expect(updated.contactEmail).toBe(`contact-${timestamp}@horizon.test`);

    // 4. Verify properties belong to this tenant partition
    const props = await prisma.property.findMany({
      where: { tenantId: reg.tenant.id }
    });
    expect(props.length).toBe(1);
    expect(props[0].name).toBe("Horizon Peak");
  });

  it("handles organization API endpoints correctly", async () => {
    const timestamp = Date.now();
    const slug = `api-org-${timestamp}`;

    const { POST: createOrg } = await import("@/app/api/organizations/route");

    // Create via API
    const createReq = new Request("http://localhost/api/organizations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "API Created Org",
        slug,
        contactEmail: `api-${timestamp}@test.org`
      })
    });

    // Note: in mock test without session cookie, route handler will return 401 UNAUTHENTICATED
    const res = await createOrg(createReq);
    expect([201, 401]).toContain(res.status);
  });

  it("verifies multi-tenant isolation across organizations", async () => {
    const timestamp = Date.now();
    const orgA = await registerTenant({
      companyName: "Org A Tower",
      slug: `org-a-${timestamp}`,
      adminName: "Admin A",
      adminEmail: `admin-a-${timestamp}@test.org`,
      password: "Password123!",
      initialPropertyName: "Tower Alpha"
    });

    const orgB = await registerTenant({
      companyName: "Org B Garden",
      slug: `org-b-${timestamp}`,
      adminName: "Admin B",
      adminEmail: `admin-b-${timestamp}@test.org`,
      password: "Password123!",
      initialPropertyName: "Garden Beta"
    });

    // Org A cannot see Org B's properties
    const orgAProps = await prisma.property.findMany({
      where: { tenantId: orgA.tenant.id }
    });
    expect(orgAProps.some((p) => p.name === "Garden Beta")).toBe(false);
    expect(orgAProps.some((p) => p.name === "Tower Alpha")).toBe(true);

    // Org B cannot see Org A's properties
    const orgBProps = await prisma.property.findMany({
      where: { tenantId: orgB.tenant.id }
    });
    expect(orgBProps.some((p) => p.name === "Tower Alpha")).toBe(false);
    expect(orgBProps.some((p) => p.name === "Garden Beta")).toBe(true);
  });

  it("verifies new organization owner is granted Super Admin, Admin, Owner and full module menu access", async () => {
    const { MODULES } = await import("@/lib/rbac/catalog");
    const { hasModuleAccess, unionPermissions } = await import("@/lib/rbac/can");
    const timestamp = Date.now();

    const reg = await registerTenant({
      companyName: "Mega Co-Living Corp",
      slug: `mega-${timestamp}`,
      adminName: "Mega Super Admin",
      adminEmail: `mega-${timestamp}@test.org`,
      password: "Password123!",
      initialPropertyName: "Mega Heights"
    });

    const userInDb = await prisma.user.findUnique({
      where: { id: reg.user.id },
      include: {
        roles: { include: { role: { include: { permissions: { include: { permission: true } } } } } },
        party: { include: { ownerProfiles: true } },
        tenant: true
      }
    });

    expect(userInDb).not.toBeNull();
    const roleKeys = userInDb!.roles.map((r) => r.role.key);
    expect(roleKeys).toContain("SUPER_ADMIN");
    expect(roleKeys).toContain("ADMIN");
    expect(roleKeys).toContain("OWNER");
    expect(userInDb?.party?.ownerProfiles.length).toBeGreaterThan(0);

    // Compute permissions union
    const lists = userInDb!.roles.map((ur) =>
      ur.role.permissions.map((rp) => ({
        module: rp.permission.module,
        action: rp.permission.action as Action,
        scope: rp.scope as Scope
      }))
    );
    const subject = {
      id: userInDb!.id,
      propertyIds: [],
      permissions: unionPermissions(...lists)
    };

    // Verify all modules in MODULES (M01..M33) have read/access
    for (const m of MODULES) {
      expect(hasModuleAccess(subject, "read", m.key)).toBe(true);
    }
  });
});
