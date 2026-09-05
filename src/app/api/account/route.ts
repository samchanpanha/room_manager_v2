import { z } from "zod";
import { fail, ok, parseBody, clientIp } from "@/lib/api";
import { getAuthUser } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { logAudit } from "@/lib/audit";

const bodySchema = z.object({ name: z.string().min(2).max(120) });

/// Update the signed-in user's own profile name (self-service).
export async function PATCH(req: Request) {
  const parsed = await parseBody(req, bodySchema);
  if (parsed.response) return parsed.response;

  const user = await getAuthUser();
  if (!user) return fail(401, "UNAUTHENTICATED", "Sign in required");

  const updated = await prisma.user.update({ where: { id: user.id }, data: { name: parsed.data.name.trim() } });

  await logAudit({
    actorId: user.id,
    actorName: user.name,
    module: "M01",
    action: "update",
    entityType: "user",
    entityId: user.id,
    summary: `Updated own profile name to "${updated.name}"`,
    before: { name: user.name },
    after: { name: updated.name },
    ip: clientIp(req)
  });

  return ok({ id: updated.id, name: updated.name });
}