import { NextRequest } from "next/server";
import { z } from "zod";
import { fail, ok, parseBody } from "@/lib/api";
import { getAuthUser } from "@/lib/auth/session";
import { hasModuleAccess } from "@/lib/rbac/can";
import { deleteRateRule, updateRateRule } from "@/lib/operations/stay-service";

const patchSchema = z.object({
  toMinutes: z.coerce.number().int().positive().optional(),
  priceMinor: z.coerce.number().int().positive().optional(),
  roomType: z.string().nullable().optional(),
  effectiveFrom: z.string().optional(),
  effectiveThrough: z.string().nullable().optional(),
  isActive: z.boolean().optional()
});

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const user = await getAuthUser();
  if (!user) return fail(401, "UNAUTHENTICATED", "Sign in required");
  if (!hasModuleAccess(user, "update", "M32")) return fail(403, "FORBIDDEN", "Missing permission M32:update");
  const { id } = await ctx.params;
  const parsed = await parseBody(req, patchSchema);
  if (parsed.response) return parsed.response;
  const data = {
    toMinutes: parsed.data.toMinutes,
    priceMinor: parsed.data.priceMinor,
    roomType: parsed.data.roomType,
    effectiveFrom: parsed.data.effectiveFrom ? new Date(parsed.data.effectiveFrom) : undefined,
    effectiveThrough: parsed.data.effectiveThrough === null ? null : parsed.data.effectiveThrough ? new Date(parsed.data.effectiveThrough) : undefined,
    isActive: parsed.data.isActive
  };
  const result = await updateRateRule(id, data, { id: user.id, name: user.name });
  if (!result.ok) return fail(result.code === "NOT_FOUND" ? 404 : 400, result.code, result.message);
  return ok(result.data);
}

export async function DELETE(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const user = await getAuthUser();
  if (!user) return fail(401, "UNAUTHENTICATED", "Sign in required");
  if (!hasModuleAccess(user, "delete", "M32")) return fail(403, "FORBIDDEN", "Missing permission M32:delete");
  const { id } = await ctx.params;
  const result = await deleteRateRule(id, { id: user.id, name: user.name });
  if (!result.ok) return fail(result.code === "NOT_FOUND" ? 404 : 400, result.code, result.message);
  return ok(result.data);
}