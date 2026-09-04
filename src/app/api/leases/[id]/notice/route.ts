import { z } from "zod";
import { clientIp, fail, ok, parseBody } from "@/lib/api";
import { authorize } from "@/lib/rbac/guard";
import { giveNotice } from "@/lib/leases/service";

const bodySchema = z.object({ endDate: z.string().datetime().optional() });

/// Give notice on an active lease (§M05; the M25 tenant portal reaches the
/// same logic via /api/portal/notices after its own-lease check).
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const parsed = await parseBody(req, bodySchema);
  if (parsed.response) return parsed.response;

  const g = await authorize("update", "M05");
  if (g.response) return g.response;

  const result = await giveNotice(id, parsed.data.endDate ? new Date(parsed.data.endDate) : null, { id: g.user.id, name: g.user.name }, clientIp(req));
  if (!result.ok) {
    const status = result.code === "NOT_FOUND" ? 404 : result.code === "INVALID_TRANSITION" ? 422 : 400;
    return fail(status, result.code, result.message);
  }
  return ok({ status: "notice" });
}
