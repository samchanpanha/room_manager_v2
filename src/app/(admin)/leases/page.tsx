import Link from "next/link";
import { prisma } from "@/lib/db";
import { getAuthUser } from "@/lib/auth/session";
import { can, hasModuleAccess } from "@/lib/rbac/can";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { buttonClassName } from "@/components/ui/button-styles";
import { EmptyState, PageHeader } from "@/components/ui/misc";
import { OwnerContractActions } from "./contract-actions";
import { formatMinor } from "@/lib/money";
import { formatDate, titleCase } from "@/lib/utils";
import { Tx } from "@/components/i18n-text";

export const dynamic = "force-dynamic";

const LEASE_VARIANT: Record<string, "secondary" | "success" | "warning" | "destructive" | "info" | "outline"> = {
  draft: "secondary",
  active: "success",
  notice: "warning",
  terminated: "destructive",
  completed: "outline"
};

export default async function LeasesPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const user = await getAuthUser();
  if (!user || !hasModuleAccess(user, "read", "M05")) {
    return <EmptyState title="No access" hint="Your roles do not include read on Leases (M05)." />;
  }
  const sp = await searchParams;
  const tab = sp.tab === "contracts" ? "contracts" : "leases";
  const canCreate = can(user, "create", "M05");

  const leases = await prisma.lease.findMany({
    include: { member: { include: { party: true } }, room: { include: { floor: { include: { building: { include: { property: true } } } } } }, services: true },
    orderBy: { createdAt: "desc" }
  });
  const contracts = await prisma.ownerContract.findMany({
    include: { owner: { include: { party: true } }, building: { include: { property: true } } },
    orderBy: { createdAt: "desc" }
  });

  return (
    <div>
      <PageHeader
        title="Leases & Contracts"
        description="Member occupancy leases and owner building contracts (M05)"
        actions={
          canCreate ? (
            <>
              <Link href="/owner-contracts/new" className={buttonClassName("outline")}>
                <Tx>+ Owner contract</Tx>
              </Link>
              <Link href="/leases/new" className={buttonClassName()}>
                <Tx>+ New lease</Tx>
              </Link>
            </>
          ) : undefined
        }
      />

      <div className="mb-4 flex gap-1 border-b">
        <Link
          href="/leases"
          className={`-mb-px border-b-2 px-3 py-2 text-sm ${tab === "leases" ? "border-primary font-medium text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"}`}
        >
          Member leases ({leases.length})
        </Link>
        <Link
          href="/leases?tab=contracts"
          className={`-mb-px border-b-2 px-3 py-2 text-sm ${tab === "contracts" ? "border-primary font-medium text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"}`}
        >
          Owner contracts ({contracts.length})
        </Link>
      </div>

      {tab === "leases" ? (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Code</TableHead>
                  <TableHead>Member</TableHead>
                  <TableHead>Room</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Term</TableHead>
                  <TableHead className="text-right">Rent / mo</TableHead>
                  <TableHead>Next bill</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {leases.map((l) => (
                  <TableRow key={l.id}>
                    <TableCell>
                      <Link href={`/leases/${l.id}`} className="font-mono text-xs font-medium underline-offset-4 hover:underline">
                        {l.code}
                      </Link>
                    </TableCell>
                    <TableCell>
                      <Link href={`/members/${l.memberProfileId}`} className="underline-offset-4 hover:underline">
                        {l.member.party.name}
                      </Link>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {l.room.floor.building.property.code}/{l.room.number}
                      {l.bedId ? " (bed)" : ""}
                    </TableCell>
                    <TableCell>
                      <Badge variant={LEASE_VARIANT[l.status] ?? "secondary"}>{l.status}</Badge>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {formatDate(l.startDate)} → {l.endDate ? formatDate(l.endDate) : "open"}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatMinor(l.rentAmountMinor)}
                      {l.services.length > 0 ? (
                        <span className="ml-1 text-xs text-muted-foreground">+{l.services.length} svc</span>
                      ) : null}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {l.nextBillingDate ? l.nextBillingDate.toISOString().slice(0, 10) : "—"}
                    </TableCell>
                  </TableRow>
                ))}
                {leases.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="py-8 text-center text-sm text-muted-foreground"><Tx>
                      No leases yet — create the first one.
                    </Tx></TableCell>
                  </TableRow>
                ) : null}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Code</TableHead>
                  <TableHead>Owner</TableHead>
                  <TableHead>Building</TableHead>
                  <TableHead>Model</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Term</TableHead>
                  <TableHead className="text-right">Payout day</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {contracts.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell className="font-mono text-xs font-medium">{c.code}</TableCell>
                    <TableCell>
                      <Link href={`/owners/${c.ownerProfileId}`} className="underline-offset-4 hover:underline">
                        {c.owner.party.name}
                      </Link>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {c.building.property.code}/{c.building.name}
                    </TableCell>
                    <TableCell className="text-sm">
                      {c.model === "REVENUE_SHARE" ? `${c.sharePercent}% share` : `${formatMinor(c.fixedRentMinor ?? 0)}/mo fixed`}
                      {c.managementFeePercent > 0 ? (
                        <span className="text-xs text-muted-foreground"> · fee {c.managementFeePercent}%</span>
                      ) : null}
                    </TableCell>
                    <TableCell>
                      <Badge variant={LEASE_VARIANT[c.status] ?? "secondary"}>{c.status}</Badge>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {formatDate(c.startDate)} → {c.endDate ? formatDate(c.endDate) : "open"}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{c.payoutCycleDay}</TableCell>
                    <TableCell className="text-right">
                      <OwnerContractActions contractId={c.id} code={c.code} status={c.status} />
                    </TableCell>
                  </TableRow>
                ))}
                {contracts.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="py-8 text-center text-sm text-muted-foreground">
                      <Tx>No owner contracts yet.</Tx>
                    </TableCell>
                  </TableRow>
                ) : null}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      <p className="mt-3 text-xs text-muted-foreground">
        Lifecycle: {titleCase("draft → active → notice → terminated | completed")} — activation flips the room to occupied and
        the member to active, and schedules the first invoice; ending flips the room to cleaning and triggers deposit
        settlement.
      </p>
    </div>
  );
}
