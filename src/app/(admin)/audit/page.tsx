import { prisma } from "@/lib/db";
import { getAuthUser } from "@/lib/auth/session";
import { can } from "@/lib/rbac/can";
import { MODULES } from "@/lib/rbac/catalog";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/input";
import { EmptyState, PageHeader } from "@/components/ui/misc";
import { MODULE_BY_KEY } from "@/lib/rbac/catalog";
import { formatDate, titleCase } from "@/lib/utils";
import { Tx } from "@/components/i18n-text";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 25;

export default async function AuditPage({
  searchParams
}: {
  searchParams: Promise<{ module?: string; q?: string; page?: string }>;
}) {
  const user = await getAuthUser();
  if (!user || !can(user, "read", "M01")) {
    return <EmptyState title="No access" hint="Audit log requires read on Users & RBDC (M01)." />;
  }
  const sp = await searchParams;
  const page = Math.max(1, Number(sp.page ?? "1") || 1);

  const where = {
    ...(sp.module ? { module: sp.module } : {}),
    ...(sp.q ? { OR: [{ actorName: { contains: sp.q } }, { summary: { contains: sp.q } }] } : {})
  };

  const [logs, total] = await Promise.all([
    prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE
    }),
    prisma.auditLog.count({ where })
  ]);
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div>
      <PageHeader title="Audit Log" description="Append-only trail of every mutation — attributable and filterable" />

      <form className="mb-4 flex flex-wrap items-end gap-3" method="get">
        <div className="w-44 space-y-1.5">
          <label htmlFor="f-module" className="text-sm font-medium">
            <Tx>Module</Tx>
          </label>
          <Select id="f-module" name="module" defaultValue={sp.module ?? ""}>
            <option value=""><Tx>All modules</Tx></option>
            {MODULES.map((m) => (
              <option key={m.key} value={m.key}>
                {m.key} · {m.name}
              </option>
            ))}
          </Select>
        </div>
        <div className="w-64 space-y-1.5">
          <label htmlFor="f-q" className="text-sm font-medium">
            <Tx>Actor or summary contains</Tx>
          </label>
          <Input id="f-q" name="q" defaultValue={sp.q ?? ""} placeholder="e.g. Malis" />
        </div>
        <Button type="submit">Filter</Button>
        <a href="/audit" className="text-sm text-muted-foreground underline underline-offset-4">
          <Tx>Reset</Tx>
        </a>
      </form>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>When</TableHead>
                <TableHead>Actor</TableHead>
                <TableHead>Module</TableHead>
                <TableHead>Action</TableHead>
                <TableHead>Entity</TableHead>
                <TableHead>Summary</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {logs.map((a) => (
                <TableRow key={a.id}>
                  <TableCell className="whitespace-nowrap text-xs text-muted-foreground">{formatDate(a.createdAt)}</TableCell>
                  <TableCell className="whitespace-nowrap text-sm">{a.actorName}</TableCell>
                  <TableCell>
                    <Badge variant="secondary">{MODULE_BY_KEY.get(a.module)?.name ?? a.module}</Badge>
                  </TableCell>
                  <TableCell className="text-xs capitalize">{titleCase(a.action)}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{a.entityType}</TableCell>
                  <TableCell className="text-sm">{a.summary}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <div className="mt-4 flex items-center justify-between text-sm text-muted-foreground">
        <span>
          {total} <Tx>entries · page </Tx>{page}/{pages}
        </span>
        <div className="flex gap-2">
          {page > 1 ? (
            <a
              className="rounded-md border px-3 py-1.5 hover:bg-accent"
              href={`/audit?${new URLSearchParams({ ...(sp.module ? { module: sp.module } : {}), ...(sp.q ? { q: sp.q } : {}), page: String(page - 1) })}`}
            >
              <Tx>← Prev</Tx>
            </a>
          ) : null}
          {page < pages ? (
            <a
              className="rounded-md border px-3 py-1.5 hover:bg-accent"
              href={`/audit?${new URLSearchParams({ ...(sp.module ? { module: sp.module } : {}), ...(sp.q ? { q: sp.q } : {}), page: String(page + 1) })}`}
            >
              <Tx>Next →</Tx>
            </a>
          ) : null}
        </div>
      </div>
    </div>
  );
}
