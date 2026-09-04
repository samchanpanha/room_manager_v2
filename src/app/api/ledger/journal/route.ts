import { ok } from "@/lib/api";
import { getAuthUser } from "@/lib/auth/session";
import { journal } from "@/lib/ledger/service";

/// Journal browser (M08 screen) — append-only postings, newest first.
export async function GET(req: Request) {
  const user = await getAuthUser();
  if (!user) return Response.json({ error: "UNAUTHENTICATED", message: "Sign in required" }, { status: 401 });
  const globalRead = user.permissions.some((p) => p.module === "M08" && p.action === "read" && p.scope === "GLOBAL");
  if (!globalRead) return Response.json({ error: "FORBIDDEN", message: "Missing permission M08:read" }, { status: 403 });

  const url = new URL(req.url);
  const date = (k: string) => {
    const v = url.searchParams.get(k);
    if (!v) return undefined;
    const d = new Date(v);
    return Number.isNaN(d.getTime()) ? undefined : d;
  };
  const rows = await journal({
    accountCode: url.searchParams.get("account") ?? undefined,
    propertyId: url.searchParams.get("propertyId") ?? undefined,
    memberId: url.searchParams.get("memberId") ?? undefined,
    refType: url.searchParams.get("refType") ?? undefined,
    refId: url.searchParams.get("refId") ?? undefined,
    from: date("from"),
    to: date("to"),
    take: url.searchParams.get("take") ? Number(url.searchParams.get("take")) : undefined
  });
  return ok({ transactions: rows });
}
