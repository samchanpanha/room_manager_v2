import { z } from "zod";
import { clientIp, fail, ok, parseBody } from "@/lib/api";
import { getAuthUser } from "@/lib/auth/session";
import { hasModuleAccess } from "@/lib/rbac/can";
import { prisma } from "@/lib/db";
import { getMemberForUser } from "@/lib/portal";
import { giveNotice } from "@/lib/leases/service";

const schema = z.object({ leaseId: z.string().min(1), endDate: z.string().datetime().optional() });

/// §M25 "notice/move-out request": a member gives notice on their OWN active
/// lease. Same logic as the M05 staff route (giveNotice) — the portal only
/// adds the own-lease gate (§M25 "strictly OWN scope").
export async function POST(req: Request) {
  const parsed = await parseBody(req, schema);
  if (parsed.response) return parsed.response;
  const user = await getAuthUser();
  if (!user) return fail(401, "UNAUTHENTICATED", "Sign in required");
  if (!hasModuleAccess(user, "update", "M25")) return fail(403, "FORBIDDEN", "Missing permission M25:update");
  const member = await getMemberForUser(user);
  if (!member) return fail(404, "NOT_A_MEMBER", "This account is not linked to a member profile");

  const lease = await prisma.lease.findUnique({ where: { id: parsed.data.leaseId }, select: { memberProfileId: true } });
  if (!lease) return fail(404, "NOT_FOUND", "Lease not found");
  if (lease.memberProfileId !== member.id) return fail(403, "FORBIDDEN", "You can only give notice on your own lease");

  const result = await giveNotice(parsed.data.leaseId, parsed.data.endDate ? new Date(parsed.data.endDate) : null, { id: user.id, name: user.name }, clientIp(req));
  if (!result.ok) {
    const status = result.code === "NOT_FOUND" ? 404 : result.code === "INVALID_TRANSITION" ? 422 : 400;
    return fail(status, result.code, result.message);
  }
  return ok({ status: "notice" });
}
