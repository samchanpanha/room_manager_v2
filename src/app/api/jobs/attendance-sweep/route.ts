import { ok } from "@/lib/api";
import { authorize } from "@/lib/rbac/guard";
import { sweepStaleOpen } from "@/lib/operations/attendance-service";

/// Daily job: flag stale open punches as missed_clock_out (§M23 exception
/// report). Gate: M23:update.
export async function POST() {
  const g = await authorize("update", "M23");
  if (g.response) return g.response;
  const summary = await sweepStaleOpen({ id: g.user.id, name: g.user.name });
  return ok(summary.data);
}
