import { fail, ok } from "@/lib/api";
import { getAuthUser } from "@/lib/auth/session";
import { statementsScope } from "@/lib/operations/statements-scope";
import { listStatements } from "@/lib/operations/statements-service";

/// M24 list — owners see their own statements (§M24 "visible in owner portal").
export async function GET(req: Request) {
  const user = await getAuthUser();
  if (!user) return fail(401, "UNAUTHENTICATED", "Sign in required");
  const scope = await statementsScope(user);
  if (!scope.allowed) return fail(403, "FORBIDDEN", "Missing permission M24:read");
  const month = new URL(req.url).searchParams.get("month");
  const rows = await listStatements({ ownerProfileId: scope.ownerProfileId ?? null, propertyIds: scope.propertyIds ?? null, month });
  return ok({
    statements: rows.map((s) => ({
      id: s.id,
      code: s.code,
      month: s.month,
      status: s.status,
      owner: s.ownerProfile.party.name,
      contract: s.contract.code,
      model: s.contract.model,
      building: s.building.name,
      property: s.property.code,
      collectedMinor: s.collectedMinor,
      grossShareMinor: s.grossShareMinor,
      managementFeeMinor: s.managementFeeMinor,
      passthroughMinor: s.passthroughMinor,
      ownerMaintenanceMinor: s.ownerMaintenanceMinor,
      adjustmentsMinor: s.adjustmentsMinor,
      netMinor: s.netMinor,
      paidVia: s.paidVia,
      paidAt: s.paidAt,
      hasDoc: Boolean(s.statementDocId)
    }))
  });
}
