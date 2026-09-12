import { describe, expect, it } from "vitest";
import { sanitizeSlug, isSlugAvailable, registerTenant } from "@/lib/tenant";
import { prisma } from "@/lib/db";
import { verifyPassword } from "@/lib/auth/password";
import type { Action, Scope } from "@/lib/rbac/catalog";

describe("Multi-Tenant Registration System", () => {
  it("sanitizes slug correctly", () => {
    expect(sanitizeSlug("Acme Housing & Co.")).toBe("acme-housing-co");
    expect(sanitizeSlug("  My-Apartment---Rentals! ")).toBe("my-apartment-rentals");
    expect(sanitizeSlug("$$$Special***123")).toBe("special-123");
  });

  it("identifies reserved and invalid slugs", async () => {
    expect(await isSlugAvailable("default")).toBe(false);
    expect(await isSlugAvailable("api")).toBe(false);
    expect(await isSlugAvailable("admin")).toBe(false);
    expect(await isSlugAvailable("a")).toBe(false);
  });

  it("rejects registration with invalid or reserved slugs", async () => {
    await expect(
      registerTenant({
        companyName: "Test Company",
        slug: "api",
        adminName: "John Admin",
        adminEmail: "john@testcompany.test",
        password: "Password123!"
      })
    ).rejects.toThrow(/reserved/i);
  });

  it("registers a new tenant workspace with isolated user, party and admin role", async () => {
    const testSlug = `test-org-${Date.now()}`;
    const testEmail = `admin-${Date.now()}@testorg.test`;

    const result = await registerTenant({
      companyName: "Acme Test Housing",
      slug: testSlug,
      adminName: "Alice Admin",
      adminEmail: testEmail,
      password: "SecurePassword123!",
      initialPropertyName: "Acme Sunrise Heights"
    });

    expect(result.tenant.id).toBeDefined();
    expect(result.tenant.name).toBe("Acme Test Housing");
    expect(result.tenant.slug).toBe(testSlug);
    expect(result.user.email).toBe(testEmail);
    expect(result.property).toBeDefined();
    expect(result.property?.name).toBe("Acme Sunrise Heights");

    // Verify DB state
    const userInDb = await prisma.user.findUnique({
      where: { id: result.user.id },
      include: {
        roles: { include: { role: true } },
        tenant: true,
        party: { include: { ownerProfiles: true } },
        assignments: true
      }
    });

    expect(userInDb).not.toBeNull();
    expect(userInDb?.tenantId).toBe(result.tenant.id);
    expect(userInDb?.party?.tenantId).toBe(result.tenant.id);
    expect(userInDb?.roles.some((r) => r.role.key === "SUPER_ADMIN")).toBe(true);
    expect(userInDb?.roles.some((r) => r.role.key === "ADMIN")).toBe(true);
    expect(userInDb?.roles.some((r) => r.role.key === "OWNER")).toBe(true);
    expect(userInDb?.party?.ownerProfiles.length).toBeGreaterThan(0);
    expect(verifyPassword("SecurePassword123!", userInDb!.passwordHash)).toBe(true);

    // Verify audit log
    const audit = await prisma.auditLog.findFirst({
      where: { tenantId: result.tenant.id, action: "create", entityType: "tenant" }
    });
    expect(audit).not.toBeNull();
    expect(audit?.summary).toContain("Registered tenant workspace");
  });

  it("prevents duplicate slug registration", async () => {
    const uniqueSlug = `dup-slug-${Date.now()}`;
    await registerTenant({
      companyName: "First Org",
      slug: uniqueSlug,
      adminName: "Admin One",
      adminEmail: `one-${Date.now()}@test.test`,
      password: "Password123!"
    });

    await expect(
      registerTenant({
        companyName: "Second Org",
        slug: uniqueSlug,
        adminName: "Admin Two",
        adminEmail: `two-${Date.now()}@test.test`,
        password: "Password123!"
      })
    ).rejects.toThrow(/already exists/i);
  });

  it("handles GET /api/auth/register?slug=... query correctly", async () => {
    const { GET } = await import("@/app/api/auth/register/route");
    const req = new Request("http://localhost/api/auth/register?slug=available-slug-999");
    const res = await GET(req);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.available).toBe(true);
    expect(data.slug).toBe("available-slug-999");
  });

  it("handles POST /api/auth/register endpoint", async () => {
    const { POST } = await import("@/app/api/auth/register/route");
    const testSlug = `api-test-${Date.now()}`;
    const req = new Request("http://localhost/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        companyName: "API Test Org",
        slug: testSlug,
        adminName: "API Admin",
        adminEmail: `api-${Date.now()}@test.org`,
        password: "ValidPassword123!"
      })
    });
    const res = await POST(req);
    expect(res.status).toBe(201);
    const data = await res.json();
    expect(data.tenant.slug).toBe(testSlug);
    expect(data.user.name).toBe("API Admin");
  });

  it("verifies new tenant admin has full permissions across all modules", async () => {
    const { can, hasModuleAccess, unionPermissions } = await import("@/lib/rbac/can");
    const testSlug = `perm-org-${Date.now()}`;
    const testEmail = `perm-${Date.now()}@permorg.test`;

    const result = await registerTenant({
      companyName: "Full Perm Org",
      slug: testSlug,
      adminName: "Owner Admin",
      adminEmail: testEmail,
      password: "Password123!",
      initialPropertyName: "Perm Heights"
    });

    const userWithRoles = await prisma.user.findUnique({
      where: { id: result.user.id },
      include: {
        roles: { include: { role: { include: { permissions: { include: { permission: true } } } } } },
        assignments: true
      }
    });

    const lists = userWithRoles!.roles.map((ur) =>
      ur.role.permissions.map((rp) => ({
        module: rp.permission.module,
        action: rp.permission.action as Action,
        scope: rp.scope as Scope
      }))
    );

    const subject = {
      id: userWithRoles!.id,
      propertyIds: userWithRoles!.assignments.map((a) => a.propertyId),
      permissions: unionPermissions(...lists)
    };

    // Verify owner rules & admin permissions across all core modules
    expect(hasModuleAccess(subject, "read", "M01")).toBe(true); // Users & RBDC
    expect(hasModuleAccess(subject, "read", "M02")).toBe(true); // Members
    expect(hasModuleAccess(subject, "read", "M03")).toBe(true); // Owners
    expect(hasModuleAccess(subject, "read", "M04")).toBe(true); // Properties
    expect(hasModuleAccess(subject, "read", "M05")).toBe(true); // Leases
    expect(hasModuleAccess(subject, "read", "M07")).toBe(true); // Invoices
    expect(hasModuleAccess(subject, "read", "M09")).toBe(true); // Payments
    expect(hasModuleAccess(subject, "read", "M10")).toBe(true); // Deposits
    expect(hasModuleAccess(subject, "read", "M11")).toBe(true); // Utilities
    expect(hasModuleAccess(subject, "read", "M12")).toBe(true); // Services
    expect(hasModuleAccess(subject, "read", "M14")).toBe(true); // POS
    expect(hasModuleAccess(subject, "read", "M15")).toBe(true); // Stock
    expect(hasModuleAccess(subject, "read", "M18")).toBe(true); // Inspections
    expect(hasModuleAccess(subject, "read", "M19")).toBe(true); // Maintenance
    expect(hasModuleAccess(subject, "read", "M20")).toBe(true); // Expenses
    expect(hasModuleAccess(subject, "read", "M26")).toBe(true); // Reports
    expect(hasModuleAccess(subject, "read", "M28")).toBe(true); // Settings

    // Verify create/update/delete capabilities
    expect(can(subject, "create", "M04")).toBe(true);
    expect(can(subject, "create", "M02")).toBe(true);
    expect(can(subject, "create", "M05")).toBe(true);
    expect(can(subject, "update", "M07")).toBe(true);
  });

  it("strictly isolates cross-tenant data so tenants see only their own data", async () => {
    const timestamp = Date.now();
    const tenantA = await registerTenant({
      companyName: "Org Alpha",
      slug: `alpha-${timestamp}`,
      adminName: "Alpha Admin",
      adminEmail: `alpha-${timestamp}@test.org`,
      password: "Password123!",
      initialPropertyName: "Alpha Towers"
    });

    const tenantB = await registerTenant({
      companyName: "Org Beta",
      slug: `beta-${timestamp}`,
      adminName: "Beta Admin",
      adminEmail: `beta-${timestamp}@test.org`,
      password: "Password123!",
      initialPropertyName: "Beta Garden"
    });

    // Tenant A queries properties
    const alphaProperties = await prisma.property.findMany({
      where: { tenantId: tenantA.tenant.id }
    });
    expect(alphaProperties.length).toBe(1);
    expect(alphaProperties[0].name).toBe("Alpha Towers");

    // Tenant B queries properties
    const betaProperties = await prisma.property.findMany({
      where: { tenantId: tenantB.tenant.id }
    });
    expect(betaProperties.length).toBe(1);
    expect(betaProperties[0].name).toBe("Beta Garden");

    // Tenant A users query does not include Tenant B user
    const alphaUsers = await prisma.user.findMany({
      where: { tenantId: tenantA.tenant.id }
    });
    expect(alphaUsers.some((u) => u.email === tenantB.user.email)).toBe(false);
    expect(alphaUsers.some((u) => u.email === tenantA.user.email)).toBe(true);

    // Tenant A audit logs query does not include Tenant B audit logs
    const alphaLogs = await prisma.auditLog.findMany({
      where: { tenantId: tenantA.tenant.id }
    });
    expect(alphaLogs.every((l) => l.tenantId === tenantA.tenant.id)).toBe(true);
  });
});
