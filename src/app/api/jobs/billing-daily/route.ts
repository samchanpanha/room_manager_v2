import { ok } from "@/lib/api";
import { authorize } from "@/lib/rbac/guard";
import { applyLateFees, runDunning } from "@/lib/billing/service";

/// Daily billing job: late fees (M06) + overdue marking + dunning ladder (M07).
/// Gate: M06:update (rent engine operators).
export async function POST() {
  const g = await authorize("update", "M06");
  if (g.response) return g.response;

  const lateFees = await applyLateFees({ id: g.user.id, name: g.user.name });
  const dunning = await runDunning({ id: g.user.id, name: g.user.name });
  return ok({ lateFees, dunning });
}
