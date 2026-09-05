import { z } from "zod";
import { fail, ok, parseBody } from "@/lib/api";
import { getAuthUser } from "@/lib/auth/session";
import { hasModuleAccess } from "@/lib/rbac/can";
import { createModule, listModules } from "@/lib/operations/stay-service";

const createSchema = z.object({
  name: z.string().min(2).max(120),
  slug: z.string().min(2).max(60).regex(/^[a-z0-9-]+$/i),
  billingStrategy: z.enum(["progressive", "blended"]).optional(),
  minDurationMinutes: z.coerce.number().int().positive().optional(),
  maxDurationMinutes: z.coerce.number().int().positive().optional(),
  defaultDepositMinor: z.coerce.number().int().nonnegative().optional(),
  minGuests: z.coerce.number().int().positive().optional(),
  maxGuests: z.coerce.number().int().positive().optional(),
  sortOrder: z.coerce.number().int().optional(),
  propertyId: z.string().nullable().optional()
});

/// M32 rent modules — READ for R+ (staff read, accountant read, PM/ADMIN manage).
export async function GET() {
  const user = await getAuthUser();
  if (!user) return fail(401, "UNAUTHENTICATED", "Sign in required");
  if (!hasModuleAccess(user, "read", "M32")) return fail(403, "FORBIDDEN", "Missing permission M32:read");
  const modules = await listModules();
  return ok({ modules });
}

export async function POST(req: Request) {
  const user = await getAuthUser();
  if (!user) return fail(401, "UNAUTHENTICATED", "Sign in required");
  if (!hasModuleAccess(user, "create", "M32")) return fail(403, "FORBIDDEN", "Missing permission M32:create");
  const parsed = await parseBody(req, createSchema);
  if (parsed.response) return parsed.response;
  const result = await createModule({ ...parsed.data, propertyId: parsed.data.propertyId ?? null }, { id: user.id, name: user.name });
  if (!result.ok) return fail(result.code === "DUPLICATE" ? 409 : 400, result.code, result.message);
  return ok(result.data, 201);
}