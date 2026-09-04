import { ok } from "@/lib/api";
import { destroyCurrentSession, getAuthUser } from "@/lib/auth/session";
import { logAudit } from "@/lib/audit";

export async function POST() {
  const user = await getAuthUser();
  if (user) {
    await logAudit({
      actorId: user.id,
      actorName: user.name,
      module: "M27",
      action: "logout",
      entityType: "session",
      entityId: user.id,
      summary: "Signed out"
    });
  }
  await destroyCurrentSession();
  return ok({ signedOut: true });
}
