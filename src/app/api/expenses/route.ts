import { z } from "zod";
import { clientIp, fail, ok, parseBody } from "@/lib/api";
import { getAuthUser } from "@/lib/auth/session";
import { can } from "@/lib/rbac/can";
import { prisma } from "@/lib/db";
import { expensesScope } from "@/lib/operations/expenses-scope";
import { createExpense } from "@/lib/operations/expenses-service";

const EXPENSE_PAID_VIA = ["cash", "bank_transfer"] as const;

/// M20 list — scope-filtered (Owner = own buildings, Manager = property).
export async function GET(req: Request) {
  const user = await getAuthUser();
  if (!user) return fail(401, "UNAUTHENTICATED", "Sign in required");
  const scope = await expensesScope(user);
  if (!scope.allowed) return fail(403, "FORBIDDEN", "Missing permission M20:read");
  const url = new URL(req.url);
  const propertyId = url.searchParams.get("propertyId");
  const status = url.searchParams.get("status") ?? undefined;
  const expenses = await prisma.expense.findMany({
    where: {
      ...(propertyId ? { propertyId } : { propertyId: { in: scope.propertyIds } }),
      ...(status ? { status } : {})
    },
    include: { category: true, property: { select: { code: true } }, receiptDoc: { select: { id: true, fileName: true } } },
    orderBy: { createdAt: "desc" },
    take: 100
  });
  return ok({
    expenses: expenses.map((e) => ({
      id: e.id,
      code: e.code,
      property: e.property.code,
      category: e.category.name,
      vendorName: e.vendorName,
      description: e.description,
      expenseDate: e.expenseDate,
      amountMinor: e.amountMinor,
      paidVia: e.paidVia,
      status: e.status,
      autoApproved: e.autoApproved,
      receipt: e.receiptDoc ? { id: e.receiptDoc.id, fileName: e.receiptDoc.fileName } : null,
      hasLedger: Boolean(e.ledgerTxId)
    }))
  });
}

const createSchema = z.object({
  propertyId: z.string().min(1),
  categoryId: z.string().min(1),
  vendorName: z.string().min(2).max(120),
  description: z.string().max(500).optional(),
  expenseDate: z.coerce.date(),
  amount: z.coerce.number().positive().max(1_000_000),
  paidVia: z.enum(EXPENSE_PAID_VIA),
  receiptDocId: z.string().min(1).optional()
});

/// Record an expense (Staff W / Accountant+ in scope). Auto-approves below the
/// threshold (ledger posts); otherwise stays pending for Accountant approval.
export async function POST(req: Request) {
  const parsed = await parseBody(req, createSchema);
  if (parsed.response) return parsed.response;
  const user = await getAuthUser();
  if (!user) return fail(401, "UNAUTHENTICATED", "Sign in required");
  if (!can(user, "create", "M20", { propertyId: parsed.data.propertyId })) return fail(403, "FORBIDDEN", "Missing permission M20:create for this property");
  const result = await createExpense(
    {
      propertyId: parsed.data.propertyId,
      categoryId: parsed.data.categoryId,
      vendorName: parsed.data.vendorName,
      description: parsed.data.description ?? null,
      expenseDate: parsed.data.expenseDate,
      amountMinor: Math.round(parsed.data.amount * 100),
      paidVia: parsed.data.paidVia,
      receiptDocId: parsed.data.receiptDocId ?? null
    },
    { id: user.id, name: user.name },
    clientIp(req)
  );
  if (!result.ok) return fail(result.code === "NOT_FOUND" ? 404 : 422, result.code!, result.message);
  return ok(result.data, 201);
}
