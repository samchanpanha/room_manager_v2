import { ok } from "@/lib/api";
import { getAuthUser } from "@/lib/auth/session";
import { prisma } from "@/lib/db";

export async function GET() {
  const user = await getAuthUser();
  if (!user) return Response.json({ error: "UNAUTHENTICATED", message: "Sign in required" }, { status: 401 });
  const globalRead = user.permissions.some((p) => p.module === "M08" && p.action === "read" && p.scope === "GLOBAL");
  if (!globalRead) return Response.json({ error: "FORBIDDEN", message: "Missing permission M08:read" }, { status: 403 });
  const accounts = await prisma.ledgerAccount.findMany({ orderBy: { code: "asc" } });
  return ok({ accounts });
}
