import { z } from "zod";
import { fail, ok, parseBody } from "@/lib/api";
import { getAuthUser } from "@/lib/auth/session";
import { hasModuleAccess } from "@/lib/rbac/can";
import { createRateRule, listRateRules } from "@/lib/operations/stay-service";

const createSchema = z.object({
  moduleId: z.string().min(1),
  toMinutes: z.coerce.number().int().positive(),
  priceMinor: z.coerce.number().int().positive(),
  propertyId: z.string().nullable().optional(),
  roomType: z.string().nullable().optional(),
  effectiveFrom: z.string().optional(),
  effectiveThrough: z.string().nullable().optional(),
  isActive: z.boolean().optional()
});

export async function GET(req: Request) {
  const user = await getAuthUser();
  if (!user) return fail(401, "UNAUTHENTICATED", "Sign in required");
  if (!hasModuleAccess(user, "read", "M32")) return fail(403, "FORBIDDEN", "Missing permission M32:read");
  const moduleId = new URL(req.url).searchParams.get("moduleId") ?? undefined;
  const rules = await listRateRules(moduleId);
  return ok({ rules });
}

export async function POST(req: Request) {
  const user = await getAuthUser();
  if (!user) return fail(401, "UNAUTHENTICATED", "Sign in required");
  if (!hasModuleAccess(user, "create", "M32")) return fail(403, "FORBIDDEN", "Missing permission M32:create");
  const parsed = await parseBody(req, createSchema);
  if (parsed.response) return parsed.response;
  const data = {
    moduleId: parsed.data.moduleId,
    toMinutes: parsed.data.toMinutes,
    priceMinor: parsed.data.priceMinor,
    propertyId: parsed.data.propertyId ?? null,
    roomType: parsed.data.roomType ?? null,
    effectiveFrom: parsed.data.effectiveFrom ? new Date(parsed.data.effectiveFrom) : undefined,
    effectiveThrough: parsed.data.effectiveThrough ? new Date(parsed.data.effectiveThrough) : null,
    isActive: parsed.data.isActive
  };
  const result = await createRateRule(data, { id: user.id, name: user.name });
  if (!result.ok) return fail(result.code === "NOT_FOUND" ? 404 : 400, result.code, result.message);
  return ok(result.data, 201);
}