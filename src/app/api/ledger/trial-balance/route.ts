import { ok } from "@/lib/api";
import { getAuthUser } from "@/lib/auth/session";
import { trialBalance } from "@/lib/ledger/service";

/// Trial balance (M08 screen). GLOBAL M08:read only — members get their own
/// statement, not the books (matrix: Owner/Staff/PM have no M08 cell).
export async function GET() {
  const user = await getAuthUser();
  if (!user) return Response.json({ error: "UNAUTHENTICATED", message: "Sign in required" }, { status: 401 });
  const globalRead = user.permissions.some((p) => p.module === "M08" && p.action === "read" && p.scope === "GLOBAL");
  if (!globalRead) return Response.json({ error: "FORBIDDEN", message: "Missing permission M08:read" }, { status: 403 });
  return ok(await trialBalance());
}
