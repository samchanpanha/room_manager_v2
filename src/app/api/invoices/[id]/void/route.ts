import { z } from "zod";
import { clientIp, fail, ok, parseBody } from "@/lib/api";
import { authorize } from "@/lib/rbac/guard";
import { prisma } from "@/lib/db";
import { voidInvoice } from "@/lib/billing/service";

const bodySchema = z.object({ reason: z.string().min(3).max(500) });

/// Void (M07:void — Super Admin only per the default matrix). Reason mandatory.
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const parsed = await parseBody(req, bodySchema);

  const invoice = await prisma.invoice.findUnique({ where: { id } });
  if (!invoice) return fail(404, "NOT_FOUND", "Invoice not found");
  const g = await authorize("void", "M07", { propertyId: invoice.propertyId });
  if (g.response) return g.response;
  if (parsed.response) return parsed.response;

  const result = await voidInvoice(id, parsed.data.reason, { id: g.user.id, name: g.user.name }, clientIp(req));
  if (!result.ok) return fail(result.code === "NOT_FOUND" ? 404 : 422, result.code, result.message);
  return ok({ voided: true });
}
