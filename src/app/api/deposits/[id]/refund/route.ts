import { z } from "zod";
import { clientIp, fail, ok, parseBody } from "@/lib/api";
import { getAuthUser } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { toMinor } from "@/lib/money";
import { refundDeposit } from "@/lib/deposits/service";

const schema = z.object({
  amount: z.coerce.number().positive().nullish(), // null/omitted → full remainder
  method: z.enum(["cash", "bank_transfer", "qr", "card", "cheque"]).default("bank_transfer"),
  note: z.string().min(3).max(500)
});

/// Refund the deposit remainder — Accountant+ approval only (GLOBAL M10:update),
/// mirroring the M09 refund gate (§M10 "refunds go through M09 with approval").
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const parsed = await parseBody(req, schema);
  if (parsed.response) return parsed.response;

  const user = await getAuthUser();
  if (!user) return fail(401, "UNAUTHENTICATED", "Sign in required");
  const globalUpdate = user.permissions.some((p) => p.module === "M10" && p.action === "update" && p.scope === "GLOBAL");
  if (!globalUpdate) return fail(403, "FORBIDDEN", "Deposit refunds require Accountant approval");

  const deposit = await prisma.deposit.findUnique({ where: { id } });
  if (!deposit) return fail(404, "NOT_FOUND", "Deposit not found");

  const result = await refundDeposit(
    id,
    {
      amountMinor: parsed.data.amount == null ? null : toMinor(parsed.data.amount),
      method: parsed.data.method,
      note: parsed.data.note
    },
    { id: user.id, name: user.name },
    clientIp(req)
  );
  if (!result.ok) {
    const status =
      result.code === "NOT_FOUND" ? 404 : result.code === "LEASE_ACTIVE" || result.code === "EXCEEDS_HELD" || result.code === "NOTHING_TO_REFUND" || result.code === "ALREADY_SETTLED" ? 422 : 400;
    return fail(status, result.code, result.message);
  }
  return ok(result);
}
