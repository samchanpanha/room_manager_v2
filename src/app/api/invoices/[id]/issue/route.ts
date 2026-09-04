import { clientIp, fail, ok } from "@/lib/api";
import { authorize } from "@/lib/rbac/guard";
import { prisma } from "@/lib/db";
import { issueInvoice } from "@/lib/billing/service";

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const invoice = await prisma.invoice.findUnique({ where: { id } });
  if (!invoice) return fail(404, "NOT_FOUND", "Invoice not found");
  const g = await authorize("update", "M07", { propertyId: invoice.propertyId });
  if (g.response) return g.response;

  const result = await issueInvoice(id, { id: g.user.id, name: g.user.name }, clientIp(req));
  if (!result.ok) return fail(result.code === "NOT_FOUND" ? 404 : 422, result.code, result.message);
  return ok({ issued: true });
}
