import { z } from "zod";
import { clientIp, fail, ok, parseBody } from "@/lib/api";
import { getAuthUser } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { canApproveExpenses, expensesScope } from "@/lib/operations/expenses-scope";
import { createRecurring } from "@/lib/operations/expenses-service";

export async function GET(req: Request) {
  const user = await getAuthUser();
  if (!user) return fail(401, "UNAUTHENTICATED", "Sign in required");
  const scope = await expensesScope(user);
  if (!scope.allowed) return fail(403, "FORBIDDEN", "Missing permission M20:read");
  const url = new URL(req.url);
  const propertyId = url.searchParams.get("propertyId");
  const rows = await prisma.recurringExpense.findMany({
    where: propertyId ? { propertyId } : { propertyId: { in: scope.propertyIds } },
    include: { category: { select: { name: true } } },
    orderBy: { createdAt: "desc" }
  });
  return ok({
    recurring: rows.map((r) => ({
      id: r.id,
      vendorName: r.vendorName,
      description: r.description,
      category: r.category.name,
      amountMinor: r.amountMinor,
      paidVia: r.paidVia,
      dayOfMonth: r.dayOfMonth,
      lastRunMonth: r.lastRunMonth,
      isActive: r.isActive
    }))
  });
}

const createSchema = z.object({
  propertyId: z.string().min(1),
  categoryId: z.string().min(1),
  vendorName: z.string().min(2).max(120),
  description: z.string().max(500).optional(),
  amount: z.coerce.number().positive().max(1_000_000),
  paidVia: z.enum(["cash", "bank_transfer"]),
  dayOfMonth: z.coerce.number().int().min(1).max(28)
});

export async function POST(req: Request) {
  const parsed = await parseBody(req, createSchema);
  if (parsed.response) return parsed.response;
  const user = await getAuthUser();
  if (!user) return fail(401, "UNAUTHENTICATED", "Sign in required");
  if (!canApproveExpenses(user)) return fail(403, "FORBIDDEN", "Recurring templates require Accountant+");
  const result = await createRecurring(
    {
      propertyId: parsed.data.propertyId,
      categoryId: parsed.data.categoryId,
      vendorName: parsed.data.vendorName,
      description: parsed.data.description ?? null,
      amountMinor: Math.round(parsed.data.amount * 100),
      paidVia: parsed.data.paidVia,
      dayOfMonth: parsed.data.dayOfMonth
    },
    { id: user.id, name: user.name },
    clientIp(req)
  );
  if (!result.ok) return fail(result.code === "NOT_FOUND" ? 404 : 422, result.code!, result.message);
  return ok(result.data, 201);
}
