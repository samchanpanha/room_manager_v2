import { fail } from "@/lib/api";
import { getAuthUser } from "@/lib/auth/session";
import { NextResponse } from "next/server";
import { attendanceScope } from "@/lib/operations/attendance-scope";
import { exportCsv } from "@/lib/operations/attendance-service";

/// §M23 "CSV export for payroll" — monthly, one row per record.
export async function GET(req: Request) {
  const user = await getAuthUser();
  if (!user) return fail(401, "UNAUTHENTICATED", "Sign in required");
  const url = new URL(req.url);
  const propertyId = url.searchParams.get("propertyId");
  if (!propertyId) return fail(422, "PROPERTY_REQUIRED", "propertyId is required");
  const scope = attendanceScope(user, propertyId);
  if (!scope.allowed) return fail(403, "FORBIDDEN", "Missing permission M23:read");
  const month = url.searchParams.get("month") ?? new Date().toISOString().slice(0, 7);
  const result = await exportCsv(propertyId, month);
  if (!result.ok) return fail(422, result.code!, result.message);
  const property = await prismaSafeName(propertyId);
  return new NextResponse(result.data.csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="attendance-${property}-${month}.csv"`
    }
  });
}

async function prismaSafeName(propertyId: string): Promise<string> {
  const { prisma } = await import("@/lib/db");
  const p = await prisma.property.findUnique({ where: { id: propertyId }, select: { code: true } });
  return (p?.code ?? propertyId).toLowerCase();
}
