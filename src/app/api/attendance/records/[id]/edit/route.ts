import { z } from "zod";
import { clientIp, fail, ok, parseBody } from "@/lib/api";
import { getAuthUser } from "@/lib/auth/session";
import { can } from "@/lib/rbac/can";
import { prisma } from "@/lib/db";
import { editRecord } from "@/lib/operations/attendance-service";

const schema = z.object({
  clockInAt: z.coerce.date().optional(),
  clockOutAt: z.coerce.date().nullable().optional(),
  reason: z.string().min(3).max(500),
  note: z.string().max(500).nullish()
});

/// Correct a punch (§M23 "no edit without audit") — M23:update at the record's
/// property; the service stamps who/why and rewrites the audit trail.
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const parsed = await parseBody(req, schema);
  if (parsed.response) return parsed.response;
  const user = await getAuthUser();
  if (!user) return fail(401, "UNAUTHENTICATED", "Sign in required");
  const record = await prisma.attendanceRecord.findUnique({ where: { id }, select: { propertyId: true } });
  if (!record) return fail(404, "NOT_FOUND", "Attendance record not found");
  if (!can(user, "update", "M23", { propertyId: record.propertyId })) return fail(403, "FORBIDDEN", "Missing permission M23:update for this property");
  const result = await editRecord(
    id,
    { clockInAt: parsed.data.clockInAt, clockOutAt: parsed.data.clockOutAt ?? undefined, reason: parsed.data.reason, note: parsed.data.note ?? undefined },
    { id: user.id, name: user.name },
    clientIp(req)
  );
  if (!result.ok) return fail(result.code === "NOT_FOUND" ? 404 : 422, result.code!, result.message);
  return ok(result.data);
}
