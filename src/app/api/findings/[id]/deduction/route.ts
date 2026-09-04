import { z } from "zod";
import { clientIp, fail, ok, parseBody } from "@/lib/api";
import { getAuthUser } from "@/lib/auth/session";
import { can } from "@/lib/rbac/can";
import { prisma } from "@/lib/db";
import { proposeFindingDeduction, approveFindingDeduction, dismissFindingDeduction } from "@/lib/operations/inspections-service";

const schema = z.object({
  op: z.enum(["propose", "approve", "dismiss"]),
  amount: z.coerce.number().min(0.01).max(100_000).optional(),
  reason: z.enum(["damage", "cleaning", "unpaid_rent", "other"]).optional(),
  note: z.string().max(300).optional()
});

/// Finding → deposit deduction (matrix row 13 cross-link).
/// propose/dismiss = M18:update in scope; approve executes the M10 deduction
/// and therefore requires M10:update in the deposit's scope.
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const parsed = await parseBody(req, schema);
  if (parsed.response) return parsed.response;
  const user = await getAuthUser();
  if (!user) return fail(401, "UNAUTHENTICATED", "Sign in required");
  const finding = await prisma.inspectionFinding.findUnique({ where: { id }, include: { inspection: { select: { propertyId: true, leaseId: true } } } });
  if (!finding) return fail(404, "NOT_FOUND", "Finding not found");
  const m18Scope = { propertyId: finding.inspection.propertyId };
  const actor = { id: user.id, name: user.name };
  const ip = clientIp(req);

  if (parsed.data.op === "propose") {
    if (!parsed.data.amount) return fail(422, "AMOUNT_REQUIRED", "propose requires amount (major units)");
    if (!can(user, "update", "M18", m18Scope)) return fail(403, "FORBIDDEN", "Missing permission M18:update for this property");
    const result = await proposeFindingDeduction(id, { amountMinor: Math.round(parsed.data.amount * 100), reason: parsed.data.reason }, actor, ip);
    if (!result.ok) return fail(result.code === "NOT_FOUND" ? 404 : 422, result.code, result.message);
    return ok(result.data, 201);
  }
  if (parsed.data.op === "approve") {
    if (!can(user, "update", "M10", m18Scope)) return fail(403, "FORBIDDEN", "Missing permission M10:update — deductions are approved in Deposits");
    const result = await approveFindingDeduction(id, { reason: parsed.data.reason, note: parsed.data.note }, actor, ip);
    if (!result.ok) return fail(result.code === "NOT_FOUND" ? 404 : 422, result.code, result.message);
    return ok(result.data);
  }
  if (!can(user, "update", "M18", m18Scope) && !can(user, "update", "M10", m18Scope)) {
    return fail(403, "FORBIDDEN", "Missing permission M18:update or M10:update");
  }
  const result = await dismissFindingDeduction(id, parsed.data.note ?? "no reason given", actor, ip);
  if (!result.ok) return fail(result.code === "NOT_FOUND" ? 404 : 422, result.code, result.message);
  return ok(result.data);
}
