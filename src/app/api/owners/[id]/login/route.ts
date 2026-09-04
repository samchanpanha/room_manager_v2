import { z } from "zod";
import { clientIp, fail, ok, parseBody } from "@/lib/api";
import { authorize } from "@/lib/rbac/guard";
import { prisma } from "@/lib/db";
import { logAudit } from "@/lib/audit";
import { loadOwnerGuardTarget } from "@/lib/owners";
import { hashPassword } from "@/lib/auth/password";

const bodySchema = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(100)
});

/// Create (or replace) the owner portal login — a User with the OWNER role
/// bound to the owner's party (M03 owner_users).
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const parsed = await parseBody(req, bodySchema);
  if (parsed.response) return parsed.response;

  const target = await loadOwnerGuardTarget(id);
  if (!target) return fail(404, "NOT_FOUND", "Owner not found");
  const g = await authorize("update", "M03", { ownerUserId: target.ownerUserId });
  if (g.response) return g.response;

  const owner = await prisma.ownerProfile.findUnique({ where: { id }, include: { party: true } });
  if (!owner) return fail(404, "NOT_FOUND", "Owner not found");

  const email = parsed.data.email.toLowerCase();
  const existingUser = await prisma.user.findUnique({ where: { email } });
  if (existingUser && existingUser.partyId !== owner.partyId) {
    return fail(409, "DUPLICATE", "This email belongs to another account");
  }

  const ownerRole = await prisma.role.findUnique({ where: { key: "OWNER" } });
  if (!ownerRole) return fail(500, "MISSING_ROLE", "OWNER role not seeded");

  const user = await prisma.user.upsert({
    where: { email },
    create: {
      email,
      name: owner.party.name,
      passwordHash: hashPassword(parsed.data.password),
      partyId: owner.partyId,
      roles: { create: { roleId: ownerRole.id } }
    },
    update: { passwordHash: hashPassword(parsed.data.password), partyId: owner.partyId }
  });
  await logAudit({
    actorId: g.user.id,
    actorName: g.user.name,
    module: "M03",
    action: "update",
    entityType: "owner_login",
    entityId: user.id,
    summary: `${existingUser ? "Reset password for" : "Created"} portal login ${email} for owner ${owner.party.name}`,
    ip: clientIp(req)
  });
  return ok({ userId: user.id });
}
