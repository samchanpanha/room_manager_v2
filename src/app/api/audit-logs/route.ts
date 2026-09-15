import { ok } from "@/lib/api";
import { authorize } from "@/lib/rbac/guard";
import { prisma } from "@/lib/db";
import { tenantWhere } from "@/lib/tenant-scope";

export async function GET(req: Request) {
  const g = await authorize("read", "M01");
  if (g.response) return g.response;

  const url = new URL(req.url);
  const moduleFilter = url.searchParams.get("module") ?? undefined;
  const take = Math.min(Number(url.searchParams.get("take") ?? 50), 200);
  const logs = await prisma.auditLog.findMany({
    where: {
      ...tenantWhere(g.user), // platform root sees all workspaces; others only their own
      ...(moduleFilter ? { module: moduleFilter } : {})
    },
    orderBy: { createdAt: "desc" },
    take
  });
  return ok({ logs });
}
