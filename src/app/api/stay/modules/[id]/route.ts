import { NextRequest } from "next/server";
import { z } from "zod";
import { fail, ok, parseBody } from "@/lib/api";
import { getAuthUser } from "@/lib/auth/session";
import { hasModuleAccess } from "@/lib/rbac/can";
import { updateModule } from "@/lib/operations/stay-service";

const patchSchema = z.object({
  name: z.string().min(2).max(120).optional(),
  billingStrategy: z.enum(["progressive", "blended"]).optional(),
  minDurationMinutes: z.coerce.number().int().positive().optional(),
  maxDurationMinutes: z.coerce.number().int().positive().optional(),
  defaultDepositMinor: z.coerce.number().int().nonnegative().optional(),
  minGuests: z.coerce.number().int().positive().optional(),
  maxGuests: z.coerce.number().int().positive().optional(),
  sortOrder: z.coerce.number().int().optional(),
  isActive: z.boolean().optional()
});

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const user = await getAuthUser();
  if (!user) return fail(401, "UNAUTHENTICATED", "Sign in required");
  if (!hasModuleAccess(user, "update", "M32")) return fail(403, "FORBIDDEN", "Missing permission M32:update");
  const { id } = await ctx.params;
  const parsed = await parseBody(req, patchSchema);
  if (parsed.response) return parsed.response;
  const result = await updateModule(id, parsed.data, { id: user.id, name: user.name });
  if (!result.ok) return fail(result.code === "NOT_FOUND" ? 404 : 400, result.code, result.message);
  return ok(result.data);
}