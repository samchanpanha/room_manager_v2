import { fail, ok } from "@/lib/api";
import { getAuthUser } from "@/lib/auth/session";
import { hasModuleAccess } from "@/lib/rbac/can";
import { canSeeInvoice } from "@/lib/billing/visibility";
import { prisma } from "@/lib/db";

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const user = await getAuthUser();
  if (!user) return fail(401, "UNAUTHENTICATED", "Sign in required");
  if (!hasModuleAccess(user, "read", "M07")) return fail(403, "FORBIDDEN", "Missing permission M07:read");

  const invoice = await prisma.invoice.findUnique({
    where: { id },
    include: {
      property: true,
      member: { include: { party: true } },
      lease: true,
      items: { orderBy: [{ kind: "asc" }, { name: "asc" }] },
      creditNotes: { orderBy: { issuedAt: "desc" } }
    }
  });
  if (!invoice) return fail(404, "NOT_FOUND", "Invoice not found");

  if (!(await canSeeInvoice(user, invoice))) {
    return fail(403, "FORBIDDEN", "Invoice outside your visible scope");
  }
  return ok({ invoice });
}
