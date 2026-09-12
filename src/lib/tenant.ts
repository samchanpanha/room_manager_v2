import { prisma } from "@/lib/db";
import { hashPassword } from "@/lib/auth/password";

export interface RegisterTenantInput {
  companyName: string;
  slug: string;
  adminName: string;
  adminEmail: string;
  password: string;
  initialPropertyName?: string;
  ip?: string | null;
}

export interface RegisterTenantResult {
  tenant: {
    id: string;
    name: string;
    slug: string;
    contactEmail: string | null;
  };
  user: {
    id: string;
    name: string;
    email: string;
  };
  property?: {
    id: string;
    name: string;
    code: string;
  };
}

import { RESERVED_SLUGS, sanitizeSlug } from "./tenant-shared";
export { RESERVED_SLUGS, sanitizeSlug };

export async function isSlugAvailable(slug: string): Promise<boolean> {
  const clean = sanitizeSlug(slug);
  if (!clean || clean.length < 2) return false;
  if (RESERVED_SLUGS.has(clean)) return false;

  const existing = await prisma.tenant.findUnique({
    where: { slug: clean }
  });
  return !existing;
}

export async function registerTenant(input: RegisterTenantInput): Promise<RegisterTenantResult> {
  const cleanSlug = sanitizeSlug(input.slug);
  if (!cleanSlug || cleanSlug.length < 2) {
    throw new Error("Invalid workspace slug");
  }
  if (RESERVED_SLUGS.has(cleanSlug)) {
    throw new Error("This workspace slug is reserved");
  }

  const existingSlug = await prisma.tenant.findUnique({
    where: { slug: cleanSlug }
  });
  if (existingSlug) {
    throw new Error("A workspace with this slug already exists");
  }

  const cleanEmail = input.adminEmail.trim().toLowerCase();
  const existingUser = await prisma.user.findUnique({
    where: { email: cleanEmail }
  });
  if (existingUser) {
    throw new Error("A user with this email address already exists");
  }

  // Find SUPER_ADMIN, ADMIN, OWNER roles for full permissions & owner rules
  const rolesToAssign = await prisma.role.findMany({
    where: { key: { in: ["SUPER_ADMIN", "ADMIN", "OWNER"] } }
  });
  if (rolesToAssign.length === 0) {
    throw new Error("System roles not configured");
  }

  const passwordHash = hashPassword(input.password);

  // Execute registration in transaction
  return await prisma.$transaction(async (tx) => {
    // 1. Create Tenant
    const tenant = await tx.tenant.create({
      data: {
        name: input.companyName.trim(),
        slug: cleanSlug,
        contactEmail: cleanEmail,
        status: "active"
      }
    });

    // 2. Create Party
    const party = await tx.party.create({
      data: {
        tenantId: tenant.id,
        type: "PERSON",
        name: input.adminName.trim(),
        email: cleanEmail
      }
    });

    // 3. Create Owner Profile (gives full Owner portal and landlord permissions)
    await tx.ownerProfile.create({
      data: {
        partyId: party.id,
        companyName: input.companyName.trim(),
        status: "active"
      }
    });

    // 4. Create User
    const user = await tx.user.create({
      data: {
        tenantId: tenant.id,
        name: input.adminName.trim(),
        email: cleanEmail,
        passwordHash,
        partyId: party.id,
        status: "active",
        totpEnabled: true
      }
    });

    // 5. Assign Full Permission Roles: SUPER_ADMIN, ADMIN, OWNER
    for (const r of rolesToAssign) {
      await tx.userRole.create({
        data: {
          userId: user.id,
          roleId: r.id
        }
      });
    }

    // 5. Optionally create Initial Property
    let createdProperty: { id: string; name: string; code: string } | undefined;
    if (input.initialPropertyName && input.initialPropertyName.trim()) {
      const suffix = Math.floor(1000 + Math.random() * 9000);
      const propCode = `P-${cleanSlug.slice(0, 6).toUpperCase()}-${suffix}`;
      const property = await tx.property.create({
        data: {
          tenantId: tenant.id,
          name: input.initialPropertyName.trim(),
          code: propCode,
          status: "active"
        }
      });

      await tx.userPropertyAssignment.create({
        data: {
          userId: user.id,
          propertyId: property.id
        }
      });

      createdProperty = {
        id: property.id,
        name: property.name,
        code: property.code
      };
    }

    // 6. Initialize Workspace Organization Settings
    await tx.setting.create({
      data: {
        tenantId: tenant.id,
        key: "m28.org",
        value: JSON.stringify({
          name: input.companyName.trim(),
          legalName: input.companyName.trim(),
          address: "",
          phone: "",
          email: cleanEmail,
          website: "",
          taxId: "",
          logo: "",
          invoiceFooterNote: `Thank you for choosing ${input.companyName.trim()}.`,
          invoiceTemplate: "classic"
        }),
        updatedBy: user.id
      }
    });

    // 7. Audit Log
    await tx.auditLog.create({
      data: {
        tenantId: tenant.id,
        actorId: user.id,
        actorName: user.name,
        module: "M00",
        action: "create",
        entityType: "tenant",
        entityId: tenant.id,
        summary: `Registered tenant workspace ${tenant.name} (${tenant.slug}) with admin ${user.email}`,
        ip: input.ip ?? null
      }
    });

    return {
      tenant: {
        id: tenant.id,
        name: tenant.name,
        slug: tenant.slug,
        contactEmail: tenant.contactEmail
      },
      user: {
        id: user.id,
        name: user.name,
        email: user.email
      },
      property: createdProperty
    };
  });
}
