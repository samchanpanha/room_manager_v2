import { z } from "zod";
import { clientIp, fail, ok, parseBody } from "@/lib/api";
import { getAuthUser } from "@/lib/auth/session";
import { can } from "@/lib/rbac/can";
import { clockBySession } from "@/lib/operations/attendance-service";

const schema = z.object({
  propertyId: z.string().min(1),
  action: z.enum(["in", "out"]),
  lat: z.coerce.number().min(-90).max(90).optional(),
  lng: z.coerce.number().min(-180).max(180).optional()
});

/// M23 mobile clock (§M23 "or mobile"): the session is the credential — a user
/// may always clock themselves (OWN scope), no property grant required.
export async function POST(req: Request) {
  const parsed = await parseBody(req, schema);
  if (parsed.response) return parsed.response;
  const user = await getAuthUser();
  if (!user) return fail(401, "UNAUTHENTICATED", "Sign in required");
  if (!can(user, "create", "M23", { ownerUserId: user.id })) {
    return fail(403, "FORBIDDEN", "Missing permission M23:create (own clock)");
  }
  const result = await clockBySession(
    { userId: user.id, userName: user.name, propertyId: parsed.data.propertyId, action: parsed.data.action, lat: parsed.data.lat ?? null, lng: parsed.data.lng ?? null },
    clientIp(req)
  );
  if (!result.ok) return fail(result.code === "NOT_FOUND" ? 404 : 422, result.code!, result.message);
  return ok(result.data!, 201);
}
