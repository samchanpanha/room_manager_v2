import { z } from "zod";
import { clientIp, fail, ok, parseBody } from "@/lib/api";
import { authorize } from "@/lib/rbac/guard";
import { prisma } from "@/lib/db";
import { logAudit } from "@/lib/audit";
import { emitDomainEvent } from "@/lib/events";
import { toMinor } from "@/lib/money";

const contactSchema = z.object({
  name: z.string().min(2).max(120),
  relationship: z.string().min(2).max(60),
  phone: z.string().min(5).max(40),
  email: z.string().email().optional(),
  isPrimary: z.boolean().default(false)
});

const createSchema = z.object({
  name: z.string().min(2).max(120),
  email: z.string().email().optional(),
  phone: z.string().max(40).optional(),
  nationality: z.string().max(60).optional(),
  idNumber: z.string().max(60).optional(),
  occupation: z.string().max(80).optional(),
  monthlyIncome: z.coerce.number().min(0).max(10_000_000).optional(),
  notes: z.string().max(500).optional(),
  homePropertyId: z.string().optional(),
  emergencyContacts: z.array(contactSchema).min(1, "At least one emergency contact is required")
});

/// Member onboarding (M02): creates party + profile + emergency contacts atomically.
export async function POST(req: Request) {
  const parsed = await parseBody(req, createSchema);
  if (parsed.response) return parsed.response;
  const d = parsed.data;

  const property = d.homePropertyId
    ? await prisma.property.findUnique({ where: { id: d.homePropertyId } })
    : null;
  if (d.homePropertyId && !property) return fail(404, "NOT_FOUND", "Home property not found");

  const g = await authorize("create", "M02", property ? { propertyId: property.id } : undefined);
  if (g.response) return g.response;

  if (d.email) {
    const existingParty = await prisma.party.findUnique({ where: { id: `party_${d.email.toLowerCase()}` } });
    if (existingParty) return fail(409, "DUPLICATE", "A member with this email already exists");
  }

  const member = await prisma.$transaction(async (tx) => {
    const party = await tx.party.create({
      data: { type: "PERSON", name: d.name, email: d.email?.toLowerCase(), phone: d.phone }
    });
    return tx.memberProfile.create({
      data: {
        partyId: party.id,
        homePropertyId: property?.id ?? null,
        nationality: d.nationality,
        idNumber: d.idNumber,
        occupation: d.occupation,
        monthlyIncomeMinor: d.monthlyIncome === undefined ? null : toMinor(d.monthlyIncome),
        notes: d.notes,
        emergencyContacts: {
          create: d.emergencyContacts.map((c) => ({
            name: c.name,
            relationship: c.relationship,
            phone: c.phone,
            email: c.email,
            isPrimary: c.isPrimary
          }))
        }
      },
      include: { party: true, emergencyContacts: true }
    });
  });

  await logAudit({
    actorId: g.user.id,
    actorName: g.user.name,
    module: "M02",
    action: "create",
    entityType: "member",
    entityId: member.id,
    summary: `Onboarded member ${member.party.name} (prospect)${property ? ` for ${property.code}` : ""} with ${member.emergencyContacts.length} emergency contact(s)`,
    propertyId: property?.id ?? null,
    after: { status: member.status, party: member.party.name },
    ip: clientIp(req)
  });
  await emitDomainEvent("member.onboarded", { memberId: member.id, name: member.party.name }, property?.id ?? null);
  return ok({ id: member.id }, 201);
}
