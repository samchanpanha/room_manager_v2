import { ok } from "@/lib/api";
import { authorize } from "@/lib/rbac/guard";
import { escalateSlaBreaches } from "@/lib/operations/maintenance-service";

/// Daily operations job: SLA breach sweep for M19 tickets + M22 complaints.
/// Gate: M19:update (staff and above). Escalation notifications arrive with M21.
export async function POST() {
  const g = await authorize("update", "M19");
  if (g.response) return g.response;
  const summary = await escalateSlaBreaches({ id: g.user.id, name: g.user.name });
  return ok(summary);
}
