import { z } from "zod";
import { clientIp, fail, ok, parseBody } from "@/lib/api";
import { authorize } from "@/lib/rbac/guard";
import { getAuthUser } from "@/lib/auth/session";
import { hasModuleAccess } from "@/lib/rbac/can";
import { prisma } from "@/lib/db";
import { assignService } from "@/lib/services/service";
import { visiblePropertyScope, propertyInScope } from "@/lib/rbac/propscope";

/// M12 assignments — scoped by the lease's property.
export async function GET() {
  const user = await getAuthUser();
  if (!user) return fail(401, "UNAUTHENTICATED", "Sign in required");
  if (!hasModuleAccess(user, "read", "M12")) return fail(403, "FORBIDDEN", "Missing permission M12:read");
  const assignments = await prisma.serviceAssignment.findMany({
    include: {
      service: true,
      lease: { include: { member: { include: { party: true } }, room: true } },
      parkingSlot: true,
      wifiAccount: true
    },
    orderBy: { createdAt: "desc" },
    take: 200
  });
  const scope = await visiblePropertyScope(user, user.permissions, "M12");
  const visible = assignments.filter((a) => propertyInScope(a.lease.propertyId, scope));
  return ok({
    assignments: visible.map((a) => ({
      id: a.id,
      service: { id: a.serviceId, code: a.service.code, name: a.service.name, pricingModel: a.service.pricingModel, unitPriceMinor: a.service.unitPriceMinor },
      lease: { id: a.leaseId, code: a.lease.code, member: a.lease.member.party.name, room: a.lease.room.number },
      status: a.status,
      startDate: a.startDate,
      suspendedAt: a.suspendedAt,
      endedAt: a.endedAt,
      parkingSlot: a.parkingSlot ? { code: a.parkingSlot.code, monthlyFeeMinor: a.parkingSlot.monthlyFeeMinor } : null,
      wifiAccount: a.wifiAccount ? { ssid: a.wifiAccount.ssid, status: a.wifiAccount.status } : null
    }))
  });
}

const schema = z.object({
  leaseId: z.string().min(1),
  serviceId: z.string().min(1),
  startDate: z.string().datetime().optional(),
  parkingSlotCode: z.string().min(1).optional(),
  wifiSsid: z.string().min(1).optional(),
  note: z.string().max(300).optional()
});

/// Assign a catalog service to a lease (parking slot unique, WiFi activates).
export async function POST(req: Request) {
  const parsed = await parseBody(req, schema);
  if (parsed.response) return parsed.response;
  const lease = await prisma.lease.findUnique({ where: { id: parsed.data.leaseId } });
  if (!lease) return fail(404, "NOT_FOUND", "Lease not found");
  const g = await authorize("create", "M12", { propertyId: lease.propertyId });
  if (g.response) return g.response;
  const result = await assignService(
    lease.id,
    {
      serviceId: parsed.data.serviceId,
      startDate: parsed.data.startDate ? new Date(parsed.data.startDate) : undefined,
      parkingSlotCode: parsed.data.parkingSlotCode,
      wifiSsid: parsed.data.wifiSsid,
      note: parsed.data.note
    },
    { id: g.user.id, name: g.user.name },
    clientIp(req)
  );
  if (!result.ok) {
    const status = result.code === "NOT_FOUND" ? 404 : result.code === "LEASE_NOT_ACTIVE" || result.code === "SLOT_TAKEN" || result.code === "WIFI_TAKEN" || result.code === "SLOT_OTHER_PROPERTY" || result.code === "WIFI_OTHER_PROPERTY" ? 422 : 400;
    return fail(status, result.code, result.message);
  }
  return ok(result.data, 201);
}
