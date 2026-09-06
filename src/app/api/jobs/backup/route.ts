import { fail, ok, clientIp } from "@/lib/api";
import { getAuthUser } from "@/lib/auth/session";
import { backupDatabase } from "@/lib/backup";
import { logAudit } from "@/lib/audit";
import { hasModuleAccess } from "@/lib/rbac/can";

/// §M27 nightly backup job (cron shape: POST after backup window). Snapshot =
/// Postgres `pg_dump` custom-format (consistent on a live DB), newest 7 kept;
/// runbook: docs/BACKUP.md. M27:update (Admin+/Super Admin, §15 v1.4c).
export async function POST(req: Request) {
  const user = await getAuthUser();
  if (!user) return fail(401, "UNAUTHENTICATED", "Sign in required");
  if (!hasModuleAccess(user, "update", "M27")) return fail(403, "FORBIDDEN", "Missing permission M27:update");
  const result = await backupDatabase();
  await logAudit({
    actorId: user.id,
    actorName: user.name,
    module: "M27",
    action: "create",
    entityType: "backup",
    entityId: result.file,
    summary: `Backup snapshot created (${(result.bytes / 1024).toFixed(0)} KB, ${result.pruned.length} pruned)`,
    ip: clientIp(req)
  });
  return ok(result);
}
