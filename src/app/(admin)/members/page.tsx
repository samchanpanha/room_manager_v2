import Link from "next/link";
import { prisma } from "@/lib/db";
import { getAuthUser } from "@/lib/auth/session";
import { can, hasModuleAccess, type EffectivePermission } from "@/lib/rbac/can";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { buttonClassName } from "@/components/ui/button-styles";
import { Input, Select } from "@/components/ui/input";
import { EmptyState, PageHeader } from "@/components/ui/misc";
import { MEMBER_STATUSES } from "@/lib/members/lifecycle";
import { formatDate, titleCase } from "@/lib/utils";
import { formatMinor } from "@/lib/money";
import { Tx } from "@/components/i18n-text";

export const dynamic = "force-dynamic";

function readScopeWhere(
  permissions: EffectivePermission[],
  propertyIds: string[]
): Record<string, unknown> {
  const grants = permissions.filter((p) => p.module === "M02" && p.action === "read");
  if (grants.some((g) => g.scope === "GLOBAL")) return {};
  if (grants.some((g) => g.scope === "PROPERTY")) return { homePropertyId: { in: propertyIds } };
  return { id: "___none___" }; // OWN scope resolves through the tenant portal (Phase 18)
}

export default async function MembersPage({
  searchParams
}: {
  searchParams: Promise<{ status?: string; propertyId?: string; q?: string }>;
}) {
  const user = await getAuthUser();
  if (!user || !hasModuleAccess(user, "read", "M02")) {
    return <EmptyState title="No access" hint="Your roles do not include read on Members (M02)." />;
  }
  const sp = await searchParams;

  const scopeWhere = readScopeWhere(user.permissions, user.propertyIds);
  const where: Record<string, unknown> = {
    ...scopeWhere,
    ...(sp.status ? { status: sp.status } : {}),
    ...(sp.propertyId ? { homePropertyId: sp.propertyId } : {}),
    ...(sp.q
      ? {
          OR: [
            { party: { name: { contains: sp.q } } },
            { party: { email: { contains: sp.q } } },
            { idNumber: { contains: sp.q } }
          ]
        }
      : {})
  };

  const [members, properties, dues] = await Promise.all([
    prisma.memberProfile.findMany({
      where,
      include: { party: true, homeProperty: true },
      orderBy: { createdAt: "desc" }
    }),
    prisma.property.findMany({ orderBy: { code: "asc" } }),
    prisma.invoice.groupBy({
      by: ["memberProfileId"],
      where: { status: { in: ["issued", "partial_paid", "overdue"] }, amountDueMinor: { gt: 0 } },
      _sum: { amountDueMinor: true }
    })
  ]);
  const duesByMember = new Map(dues.map((d) => [d.memberProfileId, d._sum.amountDueMinor ?? 0]));

  return (
    <div>
      <PageHeader
        title="Members"
        description="Tenant lifecycle: prospect → verified → active → notice → moved_out"
        actions={
          can(user, "create", "M02") ? (
            <Link href="/members/new" className={buttonClassName()}>
              <Tx>+ Onboard member</Tx>
            </Link>
          ) : undefined
        }
      />

      <form method="get" className="mb-4 flex flex-wrap items-end gap-3">
        <div className="w-40 space-y-1.5">
          <label htmlFor="f-status" className="text-sm font-medium">
            <Tx>Status</Tx>
          </label>
          <Select id="f-status" name="status" defaultValue={sp.status ?? ""}>
            <option value=""><Tx>All statuses</Tx></option>
            {MEMBER_STATUSES.map((s) => (
              <option key={s} value={s}>
                {titleCase(s)}
              </option>
            ))}
          </Select>
        </div>
        <div className="w-48 space-y-1.5">
          <label htmlFor="f-prop" className="text-sm font-medium">
            <Tx>Property</Tx>
          </label>
          <Select id="f-prop" name="propertyId" defaultValue={sp.propertyId ?? ""}>
            <option value=""><Tx>All properties</Tx></option>
            {properties.map((p) => (
              <option key={p.id} value={p.id}>
                {p.code} · {p.name}
              </option>
            ))}
          </Select>
        </div>
        <div className="w-56 space-y-1.5">
          <label htmlFor="f-q" className="text-sm font-medium">
            <Tx>Search name / email / ID</Tx>
          </label>
          <Input id="f-q" name="q" defaultValue={sp.q ?? ""} />
        </div>
        <button type="submit" className="inline-flex h-9 items-center justify-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground shadow hover:bg-primary/90"><Tx>Filter</Tx></button>
        <Link href="/members" className="pb-2 text-sm text-muted-foreground underline underline-offset-4">
          <Tx>Reset</Tx>
        </Link>
      </form>

      {members.length === 0 ? (
        <EmptyState title="No members match" hint="Adjust the filters, or onboard your first member." />
      ) : (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Property</TableHead>
                  <TableHead>Contact</TableHead>
                  <TableHead>KYC</TableHead>
                  <TableHead className="text-right">Owing</TableHead>
                  <TableHead>Onboarded</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {members.map((m) => (
                  <TableRow key={m.id}>
                    <TableCell>
                      <Link
                        href={`/members/${m.id}`}
                        className="font-medium underline-offset-4 hover:underline"
                      >
                        {m.party.name}
                      </Link>
                      {m.blacklisted ? (
                        <Badge variant="destructive" className="ml-2">
                          blacklisted
                        </Badge>
                      ) : null}
                      <p className="text-xs text-muted-foreground">{m.party.email ?? m.idNumber ?? "—"}</p>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          m.status === "active" ? "success" : m.status === "verified" ? "info" : m.status === "moved_out" ? "secondary" : "outline"
                        }
                      >
                        {m.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {m.homeProperty ? m.homeProperty.code : "—"}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">{m.party.phone ?? "—"}</TableCell>
                    <TableCell>
                      {m.kycCompletedAt ? (
                        <Badge variant="success">complete</Badge>
                      ) : (
                        <Badge variant="warning">pending</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      {(() => {
                        const owing = duesByMember.get(m.id) ?? 0;
                        return owing > 0 ? (
                          <Badge variant="warning" className="tabular-nums">
                            {formatMinor(owing)} due
                          </Badge>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        );
                      })()}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">{formatDate(m.createdAt)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
