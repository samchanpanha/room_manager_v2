import { fail, ok } from "@/lib/api";
import { getAuthUser } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { attendanceScope } from "@/lib/operations/attendance-scope";

/// M23 exception report (§M23 "flags missed punches") — range + status filter.
export async function GET(req: Request) {
  const user = await getAuthUser();
  if (!user) return fail(401, "UNAUTHENTICATED", "Sign in required");
  const url = new URL(req.url);
  const propertyId = url.searchParams.get("propertyId");
  if (!propertyId) return fail(422, "PROPERTY_REQUIRED", "propertyId is required");
  const scope = attendanceScope(user, propertyId);
  if (!scope.allowed) return fail(403, "FORBIDDEN", "Missing permission M23:read");
  const status = url.searchParams.get("status") ?? "open";
  const now = new Date();
  const from = url.searchParams.get("from") ? new Date(url.searchParams.get("from")!) : new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const to = url.searchParams.get("to") ? new Date(url.searchParams.get("to")!) : new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
  const rows = await prisma.attendanceException.findMany({
    where: {
      propertyId,
      workDate: { gte: from, lt: to },
      ...(status !== "all" ? { status } : {}),
      ...(scope.userId ? { userId: scope.userId } : {})
    },
    include: { user: { select: { name: true, email: true } }, resolvedBy: { select: { name: true } } },
    orderBy: { workDate: "desc" },
    take: 200
  });
  return ok({
    exceptions: rows.map((e) => ({
      id: e.id,
      type: e.type,
      detail: e.detail,
      status: e.status,
      workDate: e.workDate,
      userName: e.user.name,
      email: e.user.email,
      resolvedByName: e.resolvedBy?.name ?? null,
      resolvedAt: e.resolvedAt,
      resolution: e.resolution
    }))
  });
}
