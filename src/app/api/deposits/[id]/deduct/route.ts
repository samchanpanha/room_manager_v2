import { z } from "zod";
import { clientIp, fail, ok, parseBody } from "@/lib/api";
import { getAuthUser } from "@/lib/auth/session";
import { can, hasModuleAccess } from "@/lib/rbac/can";
import { prisma } from "@/lib/db";
import { toMinor } from "@/lib/money";
import { deductDeposit } from "@/lib/deposits/service";

const schema = z.object({
  amount: z.coerce.number().positive(),
  reason: z.enum(["damage", "cleaning", "unpaid_rent", "other"]),
  evidenceDocId: z.string().min(1),
  note: z.string().min(3).max(500)
});

/// Deduct from the deposit with mandatory evidence (move-out settlement).
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const parsed = await parseBody(req, schema);
  if (parsed.response) return parsed.response;

  const user = await getAuthUser();
  if (!user) return fail(401, "UNAUTHENTICATED", "Sign in required");
  if (!hasModuleAccess(user, "update", "M10")) return fail(403, "FORBIDDEN", "Missing permission M10:update");

  const deposit = await prisma.deposit.findUnique({ where: { id } });
  if (!deposit) return fail(404, "NOT_FOUND", "Deposit not found");
  if (!can(user, "update", "M10", { propertyId: deposit.propertyId ?? undefined })) {
    return fail(403, "FORBIDDEN", "Deposit outside your assigned properties");
  }

  const result = await deductDeposit(
    id,
    {
      amountMinor: toMinor(parsed.data.amount),
      reason: parsed.data.reason,
      evidenceDocId: parsed.data.evidenceDocId,
      note: parsed.data.note
    },
    { id: user.id, name: user.name },
    clientIp(req)
  );
  if (!result.ok) {
    const status =
      result.code === "NOT_FOUND" ? 404 : result.code === "LEASE_ACTIVE" || result.code === "EXCEEDS_HELD" || result.code === "ALREADY_SETTLED" ? 422 : 400;
    return fail(status, result.code, result.message);
  }
  return ok(result);
}
