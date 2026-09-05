import { z } from "zod";
import { fail, ok, parseBody, clientIp } from "@/lib/api";
import { getAuthUser } from "@/lib/auth/session";
import { hasModuleAccess, can } from "@/lib/rbac/can";
import { placePurchaseOrder, receivePurchaseOrder, voidPurchaseOrder, purchaseOrderById } from "@/lib/operations/po-service";
import type { AuthUser } from "@/lib/auth/session";

type Po = NonNullable<Awaited<ReturnType<typeof purchaseOrderById>>>;

async function loadPo(id: string) {
  return purchaseOrderById(id);
}

async function authorize(req: Request, poId: string): Promise<{ user: AuthUser; po: Po } | { error: Response }> {
  const user = await getAuthUser();
  if (!user) return { error: fail(401, "UNAUTHENTICATED", "Sign in required") };
  if (!hasModuleAccess(user, "update", "M29")) return { error: fail(403, "FORBIDDEN", "Missing permission M29:update") };
  const po = await loadPo(poId);
  if (!po) return { error: fail(404, "NOT_FOUND", "Purchase order not found") };
  if (!can(user, "update", "M29", { propertyId: po.propertyId })) {
    return { error: fail(403, "FORBIDDEN", "No access on this purchase order") };
  }
  return { user, po };
}

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const user = await getAuthUser();
  if (!user) return fail(401, "UNAUTHENTICATED", "Sign in required");
  if (!hasModuleAccess(user, "read", "M29")) return fail(403, "FORBIDDEN", "Missing permission M29:read");
  const { id } = await ctx.params;
  const po = await loadPo(id);
  if (!po) return fail(404, "NOT_FOUND", "Purchase order not found");
  if (!can(user, "read", "M29", { propertyId: po.propertyId })) return fail(403, "FORBIDDEN", "No read access on this purchase order");
  return ok({ purchaseOrder: po });
}

/// Place a draft order → placed (locks the order for receiving).
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const ip = clientIp(req);
  const { id } = await ctx.params;
  const auth = await authorize(req, id);
  if ("error" in auth) return auth.error;
  const parsed = await parseBody(req, z.object({}));
  if (parsed.response) return parsed.response;
  const result = await placePurchaseOrder(id, { id: auth.user.id, name: auth.user.name }, ip);
  if (!result.ok) return fail(400, result.code, result.message);
  return ok(result.data);
}

/// Receive one or more lines → posts `purchase` stock movements (M15 engine).
export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const ip = clientIp(req);
  const { id } = await ctx.params;
  const auth = await authorize(req, id);
  if ("error" in auth) return auth.error;
  const parsed = await parseBody(
    req,
    z.object({
      received: z.array(z.object({ lineId: z.string().min(1), qtyMilli: z.coerce.number().int().positive() })).min(1).max(100)
    })
  );
  if (parsed.response) return parsed.response;
  const result = await receivePurchaseOrder(id, parsed.data.received, { id: auth.user.id, name: auth.user.name }, ip);
  if (!result.ok) return fail(400, result.code, result.message);
  return ok(result.data);
}

/// Void a draft/placed order (no stock impact if nothing received yet).
export async function DELETE(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const ip = clientIp(req);
  const { id } = await ctx.params;
  const auth = await authorize(req, id);
  if ("error" in auth) return auth.error;
  const result = await voidPurchaseOrder(id, { id: auth.user.id, name: auth.user.name }, ip);
  if (!result.ok) return fail(400, result.code, result.message);
  return ok(result.data);
}