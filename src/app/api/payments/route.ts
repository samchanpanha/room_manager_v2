import { z } from "zod";
import { clientIp, fail, ok, parseBody } from "@/lib/api";
import { getAuthUser } from "@/lib/auth/session";
import { hasModuleAccess } from "@/lib/rbac/can";
import { toMinor } from "@/lib/money";
import { prisma } from "@/lib/db";
import { createPayment } from "@/lib/payments/service";
import { canCreateForMember, visiblePaymentScope, paymentInScope } from "@/lib/payments/visibility";

const createSchema = z.object({
  memberProfileId: z.string().min(1),
  method: z.enum(["cash", "bank_transfer", "qr", "card", "cheque"]),
  amount: z.coerce.number().positive().max(1_000_000),
  allocations: z
    .array(z.object({ invoiceId: z.string().min(1), amount: z.coerce.number().positive() }))
    .max(50)
    .optional(),
  idempotencyKey: z.string().min(8).max(120).optional(),
  gatewayRef: z.string().min(3).max(120).nullish()
});

export async function POST(req: Request) {
  const parsed = await parseBody(req, createSchema);
  if (parsed.response) return parsed.response;

  const user = await getAuthUser();
  if (!user) return fail(401, "UNAUTHENTICATED", "Sign in required");
  if (!hasModuleAccess(user, "create", "M09")) return fail(403, "FORBIDDEN", "Missing permission M09:create");

  if (!(await canCreateForMember(user, parsed.data.memberProfileId))) {
    return fail(403, "FORBIDDEN", "You cannot record payments for this member");
  }

  const d = parsed.data;
  const result = await createPayment(
    { id: user.id, name: user.name },
    {
      memberProfileId: d.memberProfileId,
      method: d.method,
      amountMinor: toMinor(d.amount),
      allocations: d.allocations?.map((a) => ({ invoiceId: a.invoiceId, amountMinor: toMinor(a.amount) })),
      idempotencyKey: d.idempotencyKey ?? null,
      gatewayRef: d.gatewayRef ?? null
    },
    clientIp(req)
  );
  if (!result.ok) {
    const status = result.code === "NOT_FOUND" ? 404 : result.code === "EXCEEDS_DUE" ? 422 : 400;
    return fail(status, result.code, result.message);
  }
  return ok(result, 201);
}

export async function GET(req: Request) {
  const user = await getAuthUser();
  if (!user) return fail(401, "UNAUTHENTICATED", "Sign in required");
  if (!hasModuleAccess(user, "read", "M09")) return fail(403, "FORBIDDEN", "Missing permission M09:read");

  const url = new URL(req.url);
  const status = url.searchParams.get("status") ?? undefined;
  const method = url.searchParams.get("method") ?? undefined;

  const scope = await visiblePaymentScope(user, user.permissions);
  if (scope !== "ALL" && scope.propertyIds.length === 0 && scope.memberIds.length === 0) {
    return ok({ payments: [] });
  }
  const payments = await prisma.payment.findMany({
    where: {
      ...(status ? { status } : {}),
      ...(method ? { method } : {}),
      ...(scope === "ALL"
        ? {}
        : {
            OR: [
              { propertyId: { in: scope.propertyIds } },
              { memberProfileId: { in: scope.memberIds } }
            ]
          })
    },
    include: { member: { include: { party: true } }, allocations: { include: { invoice: true } } },
    orderBy: { receivedAt: "desc" },
    take: 200
  });
  return ok({ payments: payments.filter((p) => paymentInScope(p, scope)) });
}
