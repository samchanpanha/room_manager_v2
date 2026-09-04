import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { getAuthUser } from "@/lib/auth/session";
import { can } from "@/lib/rbac/can";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/misc";
import { LeaseActions } from "./lease-actions";
import { ServicesCard } from "./services-card";
import { timeAgo } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function LeaseDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getAuthUser();
  if (!user) notFound();

  const lease = await prisma.lease.findUnique({
    where: { id },
    include: {
      member: { include: { party: true } },
      room: { include: { floor: { include: { building: { include: { property: true } } } }, beds: true } },
      services: { orderBy: { createdAt: "asc" } }
    }
  });
  if (!lease) notFound();

  if (!can(user, "read", "M05", { propertyId: lease.propertyId })) {
    return <EmptyState title="No access to this lease" hint="Leases are property-scoped." />;
  }
  const canUpdate = can(user, "update", "M05", { propertyId: lease.propertyId });

  const activity = await prisma.auditLog.findMany({
    where: { entityType: { in: ["lease", "lease_status", "lease_service"] }, entityId: { in: [id, ...lease.services.map((s) => s.id)] } },
    orderBy: { createdAt: "desc" },
    take: 15
  });

  const contractDoc = await prisma.documentRegistry.findFirst({
    where: { entity: "LEASE", entityId: lease.id, docTypeId: "lease_contract" },
    orderBy: { version: "desc" }
  });

  const money = (minor: number) =>
    new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(minor / 100);

  return (
    <div>
      <div className="mb-4 text-sm text-muted-foreground">
        <Link href="/leases" className="underline underline-offset-4 hover:text-foreground">
          Leases
        </Link>{" "}
        / <span className="text-foreground">{lease.code}</span>
      </div>

      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 font-mono text-2xl font-semibold tracking-tight">
            {lease.code}
            <Badge variant={lease.status === "active" ? "success" : lease.status === "notice" ? "warning" : lease.status === "terminated" ? "destructive" : "secondary"}>
              {lease.status}
            </Badge>
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            <Link href={`/members/${lease.memberProfileId}`} className="underline underline-offset-4">
              {lease.member.party.name}
            </Link>{" "}
            · {lease.room.floor.building.property.code}/{lease.room.floor.building.name} / Room {lease.room.number}
            {lease.bedId ? ` (${lease.room.beds.find((b) => b.id === lease.bedId)?.label ?? "bed"})` : " (entire room)"}
          </p>
        </div>
        <LeaseActions
          lease={{ id: lease.id, code: lease.code, status: lease.status }}
          canUpdate={canUpdate}
          contractFiled={Boolean(contractDoc)}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardContent className="p-5">
            <p className="mb-3 text-sm font-medium">Terms</p>
            <dl className="space-y-2 text-sm">
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Term</dt>
                <dd>
                  {lease.startDate.toISOString().slice(0, 10)} → {lease.endDate ? lease.endDate.toISOString().slice(0, 10) : "open"}
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Rent / month</dt>
                <dd className="tabular-nums">{money(lease.rentAmountMinor)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Billing</dt>
                <dd>
                  day {lease.billingCycleDay} · {lease.prorationBasis === "thirty_day" ? "30-day" : "calendar"} proration
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Deposit</dt>
                <dd className="tabular-nums">
                  {money(lease.depositTotalMinor)} in {lease.depositInstallments} installment(s)
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Notice / renewal</dt>
                <dd>
                  {lease.noticeDays}d · {lease.autoRenew ? "auto-renews" : "manual"}
                  {lease.escalationPercent !== null ? ` · +${lease.escalationPercent}%/yr` : ""}
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Next bill</dt>
                <dd>{lease.nextBillingDate ? lease.nextBillingDate.toISOString().slice(0, 10) : "— (set on activation)"}</dd>
              </div>
              {lease.terminationReason ? (
                <div className="flex justify-between border-t pt-2">
                  <dt className="text-destructive">Terminated</dt>
                  <dd className="max-w-64 text-right text-destructive">{lease.terminationReason}</dd>
                </div>
              ) : null}
            </dl>
          </CardContent>
        </Card>

        <ServicesCard
          leaseId={lease.id}
          status={lease.status}
          services={lease.services.map((sv) => ({ id: sv.id, name: sv.name, amountMinor: sv.amountMinor, pricingModel: sv.pricingModel }))}
          canUpdate={canUpdate}
        />
      </div>

      <Card className="mt-4">
        <CardContent className="p-5">
          <p className="mb-3 text-sm font-medium">Timeline (audit)</p>
          <ul className="space-y-2.5">
            {activity.length === 0 ? <li className="text-sm text-muted-foreground">No entries yet.</li> : null}
            {activity.map((a) => (
              <li key={a.id} className="flex items-start justify-between gap-3 text-sm">
                <div>
                  <p>{a.summary}</p>
                  <p className="text-xs text-muted-foreground">
                    {a.actorName} · {a.module} · {a.action}
                  </p>
                </div>
                <span className="shrink-0 text-xs text-muted-foreground">{timeAgo(a.createdAt)}</span>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      <Card className="mt-4">
        <CardContent className="p-4 text-xs text-muted-foreground">
          Effects: activation → room occupied, member active, first invoice scheduled (generation job ships in Phase 6) · ending →
          room cleaning (when last lease in room), member moved_out, deposit settlement triggered (M10 acts from Phase 9) ·
          termination clearance/inspection gates tighten as those modules land.
        </CardContent>
      </Card>
    </div>
  );
}
