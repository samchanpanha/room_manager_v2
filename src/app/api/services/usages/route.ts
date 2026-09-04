import { z } from "zod";
import { clientIp, fail, ok, parseBody } from "@/lib/api";
import { authorize } from "@/lib/rbac/guard";
import { getAuthUser } from "@/lib/auth/session";
import { hasModuleAccess } from "@/lib/rbac/can";
import { prisma } from "@/lib/db";
import { recordUsage } from "@/lib/services/service";
import { visiblePropertyScope, propertyInScope } from "@/lib/rbac/propscope";

/// M12 per-use entries — pending ones ride the next invoice (§M12).
export async function GET() {
  const user = await getAuthUser();
  if (!user) return fail(401, "UNAUTHENTICATED", "Sign in required");
  if (!hasModuleAccess(user, "read", "M12")) return fail(403, "FORBIDDEN", "Missing permission M12:read");
  const usages = await prisma.serviceUsage.findMany({
    include: { service: true, lease: { include: { member: { include: { party: true } }, room: true } } },
    orderBy: { usedAt: "desc" },
    take: 100
  });
  const scope = await visiblePropertyScope(user, user.permissions, "M12");
  const visible = usages.filter((u) => propertyInScope(u.lease.propertyId, scope));
  return ok({
    usages: visible.map((u) => ({
      id: u.id,
      service: u.service.name,
      lease: { code: u.lease.code, member: u.lease.member.party.name, room: u.lease.room.number },
      qtyMilli: u.qtyMilli,
      unitLabel: u.unitLabel,
      amountMinor: Math.round((u.unitPriceMinor * u.qtyMilli) / 1000),
      usedAt: u.usedAt,
      status: u.status
    }))
  });
}

const schema = z.object({
  leaseId: z.string().min(1),
  serviceId: z.string().min(1),
  qty: z.coerce.number().positive(),
  usedAt: z.string().datetime().optional(),
  note: z.string().max(300).optional()
});

export async function POST(req: Request) {
  const parsed = await parseBody(req, schema);
  if (parsed.response) return parsed.response;
  const lease = await prisma.lease.findUnique({ where: { id: parsed.data.leaseId } });
  if (!lease) return fail(404, "NOT_FOUND", "Lease not found");
  const g = await authorize("create", "M12", { propertyId: lease.propertyId });
  if (g.response) return g.response;
  const result = await recordUsage(
    lease.id,
    { serviceId: parsed.data.serviceId, qty: parsed.data.qty, usedAt: parsed.data.usedAt ? new Date(parsed.data.usedAt) : undefined, note: parsed.data.note },
    { id: g.user.id, name: g.user.name },
    clientIp(req)
  );
  if (!result.ok) {
    const status = result.code === "NOT_FOUND" ? 404 : result.code === "LEASE_NOT_ACTIVE" || result.code === "INVALID_PRICING" || result.code === "INVALID_QTY" ? 422 : 400;
    return fail(status, result.code, result.message);
  }
  return ok(result.data, 201);
}
