import { z } from "zod";
import { randomBytes } from "node:crypto";
import { clientIp, fail, ok, parseBody } from "@/lib/api";
import { authorize } from "@/lib/rbac/guard";
import { prisma } from "@/lib/db";
import { logAudit } from "@/lib/audit";
import { hashPassword } from "@/lib/auth/password";

const payoutSchema = z.object({
  kind: z.enum(["BANK", "MOBILE_MONEY", "CASH", "OTHER"]),
  bankName: z.string().max(120).optional(),
  accountName: z.string().min(2).max(120),
  accountNumber: z.string().min(3).max(60)
});

const createSchema = z.object({
  name: z.string().min(2).max(120),
  email: z.string().email().optional(),
  phone: z.string().max(40).optional(),
  companyName: z.string().max(120).optional(),
  notes: z.string().max(500).optional(),
  payoutMethod: payoutSchema.optional(),
  buildingIds: z.array(z.string()).default([]),
  portalLogin: z.object({ email: z.string().email(), password: z.string().min(8).max(100) }).optional()
});

/// Create an owner (M03): party + profile + primary payout method,
/// optional building ownership and optional portal login (OWNER role).
export async function POST(req: Request) {
  const parsed = await parseBody(req, createSchema);
  if (parsed.response) return parsed.response;
  const g = await authorize("create", "M03");
  if (g.response) return g.response;
  const d = parsed.data;

  if (d.email) {
    const dupe = await prisma.party.findUnique({ where: { id: `party_${d.email.toLowerCase()}` } });
    if (dupe) return fail(409, "DUPLICATE", "A party with this email already exists");
  }
  for (const buildingId of d.buildingIds) {
    const b = await prisma.building.findUnique({ where: { id: buildingId }, include: { owner: { include: { party: true } } } });
    if (!b) return fail(404, "NOT_FOUND", `Building ${buildingId} not found`);
    if (b.ownerId) return fail(409, "BUILDING_OWNED", `${b.name} is already owned by ${b.owner?.party.name} — unassign it first`);
  }
  if (d.portalLogin) {
    const dupe = await prisma.user.findUnique({ where: { email: d.portalLogin.email.toLowerCase() } });
    if (dupe) return fail(409, "DUPLICATE", "A user with this portal email already exists");
  }

  const ownerRole = await prisma.role.findUnique({ where: { key: "OWNER" } });
  if (d.portalLogin && !ownerRole) return fail(500, "MISSING_ROLE", "OWNER role not seeded");

  const owner = await prisma.$transaction(async (tx) => {
    const partyId = d.email ? `party_${d.email.toLowerCase()}` : `party_${randomBytes(8).toString("hex")}`;
    const party = await tx.party.create({
      data: { id: partyId, type: d.companyName ? "COMPANY" : "PERSON", name: d.name, email: d.email?.toLowerCase(), phone: d.phone }
    });
    const profile = await tx.ownerProfile.create({
      data: {
        partyId: party.id,
        companyName: d.companyName,
        notes: d.notes,
        payoutMethods: d.payoutMethod ? { create: { ...d.payoutMethod, isPrimary: true } } : undefined
      }
    });
    if (d.buildingIds.length > 0) {
      await tx.building.updateMany({ where: { id: { in: d.buildingIds } }, data: { ownerId: profile.id } });
    }
    if (d.portalLogin && ownerRole) {
      await tx.user.create({
        data: {
          email: d.portalLogin.email.toLowerCase(),
          name: d.name,
          passwordHash: hashPassword(d.portalLogin.password),
          partyId: party.id,
          roles: { create: { roleId: ownerRole.id } }
        }
      });
    }
    return profile;
  });

  await logAudit({
    actorId: g.user.id,
    actorName: g.user.name,
    module: "M03",
    action: "create",
    entityType: "owner",
    entityId: owner.id,
    summary: `Onboarded owner ${d.name}${d.companyName ? ` (${d.companyName})` : ""}${d.buildingIds.length ? ` with ${d.buildingIds.length} building(s)` : ""}${d.portalLogin ? ` + portal login ${d.portalLogin.email}` : ""}`,
    after: { buildings: d.buildingIds, hasPayout: Boolean(d.payoutMethod) },
    ip: clientIp(req)
  });
  return ok({ id: owner.id }, 201);
}
