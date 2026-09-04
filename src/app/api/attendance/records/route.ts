import { z } from "zod";
import { clientIp, fail, ok, parseBody } from "@/lib/api";
import { getAuthUser } from "@/lib/auth/session";
import { can } from "@/lib/rbac/can";
import { attendanceScope } from "@/lib/operations/attendance-scope";
import { createManualRecord, listRecords } from "@/lib/operations/attendance-service";

/// M23 list — range query (defaults: current month) with OWN scoping.
export async function GET(req: Request) {
  const user = await getAuthUser();
  if (!user) return fail(401, "UNAUTHENTICATED", "Sign in required");
  const url = new URL(req.url);
  const propertyId = url.searchParams.get("propertyId");
  if (!propertyId) return fail(422, "PROPERTY_REQUIRED", "propertyId is required");
  const scope = attendanceScope(user, propertyId);
  if (!scope.allowed) return fail(403, "FORBIDDEN", "Missing permission M23:read");
  const now = new Date();
  const from = url.searchParams.get("from") ? new Date(url.searchParams.get("from")!) : new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const to = url.searchParams.get("to") ? new Date(url.searchParams.get("to")!) : new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
  const records = await listRecords({ propertyId, from, to, userId: scope.userId ?? url.searchParams.get("userId") });
  return ok({
    scope: scope.own ? "own" : "all",
    records: records.map((r) => ({
      id: r.id,
      userName: r.user.name,
      email: r.user.email,
      shiftName: r.shift?.name ?? null,
      workDate: r.workDate,
      clockInAt: r.clockInAt,
      clockOutAt: r.clockOutAt,
      minutesWorked: r.minutesWorked,
      overtimeMinutes: r.overtimeMinutes,
      source: r.source,
      editedAt: r.editedAt,
      editReason: r.editReason,
      note: r.note,
      exceptions: r.exceptions.map((e) => ({ id: e.id, type: e.type, status: e.status }))
    }))
  });
}

const createSchema = z.object({
  userId: z.string().min(1),
  propertyId: z.string().min(1),
  clockInAt: z.coerce.date(),
  clockOutAt: z.coerce.date().nullish(),
  reason: z.string().min(3).max(500),
  note: z.string().max(500).optional()
});

/// Manual entry (missed-punch remediation) — M23:update, reason mandatory.
export async function POST(req: Request) {
  const parsed = await parseBody(req, createSchema);
  if (parsed.response) return parsed.response;
  const user = await getAuthUser();
  if (!user) return fail(401, "UNAUTHENTICATED", "Sign in required");
  if (!can(user, "update", "M23", { propertyId: parsed.data.propertyId })) return fail(403, "FORBIDDEN", "Missing permission M23:update for this property");
  const result = await createManualRecord(
    { userId: parsed.data.userId, propertyId: parsed.data.propertyId, clockInAt: parsed.data.clockInAt, clockOutAt: parsed.data.clockOutAt ?? null, reason: parsed.data.reason, note: parsed.data.note ?? null },
    { id: user.id, name: user.name },
    clientIp(req)
  );
  if (!result.ok) return fail(result.code === "NOT_FOUND" ? 404 : 422, result.code!, result.message);
  return ok(result.data!, 201);
}
