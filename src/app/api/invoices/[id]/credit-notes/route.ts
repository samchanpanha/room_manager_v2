import { z } from "zod";
import { clientIp, fail, ok, parseBody } from "@/lib/api";
import { authorize } from "@/lib/rbac/guard";
import { prisma } from "@/lib/db";
import { createCreditNote } from "@/lib/billing/service";

const bodySchema = z.object({
  amount: z.coerce.number().positive(),
  reason: z.string().min(3).max(500)
});

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const parsed = await parseBody(req, bodySchema);

  const invoice = await prisma.invoice.findUnique({ where: { id } });
  if (!invoice) return fail(404, "NOT_FOUND", "Invoice not found");
  const g = await authorize("update", "M07", { propertyId: invoice.propertyId });
  if (g.response) return g.response;
  if (parsed.response) return parsed.response;

  const result = await createCreditNote(
    id,
    Math.round(parsed.data.amount * 100),
    parsed.data.reason,
    { id: g.user.id, name: g.user.name },
    clientIp(req)
  );
  if (!result.ok) return fail(result.code === "NOT_FOUND" ? 404 : result.code === "EXCEEDS_DUE" ? 422 : 400, result.code, result.message);
  return ok({ code: result.code, invoiceStatus: result.invoiceStatus }, 201);
}
