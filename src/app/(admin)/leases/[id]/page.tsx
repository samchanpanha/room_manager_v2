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
import { Tx } from "@/components/i18n-text";

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
      services: { orderBy: { createdAt: "asc" } },
      deposit: {
        include: {
          invoice: true,
          transactions: true
        }
      },
      invoices: {
        orderBy: { periodStart: "desc" },
        take: 8
      }
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

  const [catalog, parkingSlots, wifiAccounts] = await Promise.all([
    prisma.serviceCatalog.findMany({ where: { isActive: true }, orderBy: { name: "asc" } }),
    prisma.parkingSlot.findMany({ where: { propertyId: lease.propertyId, status: "free" }, orderBy: { code: "asc" } }),
    prisma.wifiAccount.findMany({ where: { propertyId: lease.propertyId, status: "free" }, orderBy: { ssid: "asc" } })
  ]);

  const depositCollected = lease.deposit?.invoice?.amountPaidMinor ?? 0;
  const depositDeducted = (lease.deposit?.transactions ?? []).filter((t) => t.type === "deduction").reduce((s, t) => s + t.amountMinor, 0);
  const depositRefunded = (lease.deposit?.transactions ?? []).filter((t) => t.type === "refund").reduce((s, t) => s + t.amountMinor, 0);
  const depositHeld = Math.max(0, depositCollected - depositDeducted - depositRefunded);

  return (
    <div>
      <div className="mb-4 text-sm text-muted-foreground">
        <Link href="/leases" className="underline underline-offset-4 hover:text-foreground">
          <Tx>Leases</Tx>
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
            · {lease.room.floor.building.property.code}/{lease.room.floor.building.name} <Tx>/ Room </Tx>{lease.room.number}
            {lease.bedId ? ` (${lease.room.beds.find((b) => b.id === lease.bedId)?.label ?? "bed"})` : " (entire room)"}
          </p>
        </div>
        <LeaseActions
          lease={{ id: lease.id, code: lease.code, status: lease.status }}
          canUpdate={canUpdate}
          contractFiled={Boolean(contractDoc)}
        />
      </div>

      {lease.status === "draft" ? (
        <div className={`mb-4 rounded-md border p-3.5 text-sm flex flex-wrap items-center justify-between gap-2 ${
          lease.member.status === "prospect"
            ? "border-amber-500/30 bg-amber-500/10 text-amber-900 dark:text-amber-200"
            : "border-blue-500/30 bg-blue-500/10 text-blue-900 dark:text-blue-200"
        }`}>
          <div>
            <span className="font-semibold">
              {lease.member.status === "prospect" ? "⚠️ KYC Verification Required Before Activation" : "ℹ️ Draft Lease Ready"}
            </span>
            <p className="mt-0.5 text-xs opacity-90">
              {lease.member.status === "prospect"
                ? `Member ${lease.member.party.name} is currently in prospect status. Complete KYC verification on the member profile before activating this lease.`
                : "Activating this lease will flip the room to Occupied, flip the member to Active, schedule the 1st monthly invoice, and generate deposit billing."}
            </p>
          </div>
          {lease.member.status === "prospect" ? (
            <Link
              href={`/members/${lease.memberProfileId}`}
              className="rounded bg-amber-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-amber-700 dark:bg-amber-500 dark:text-black dark:hover:bg-amber-400"
            >
              Verify Member KYC →
            </Link>
          ) : null}
        </div>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardContent className="p-5">
            <p className="mb-3 text-sm font-medium"><Tx>Terms</Tx></p>
            <dl className="space-y-2 text-sm">
              <div className="flex justify-between">
                <dt className="text-muted-foreground"><Tx>Term</Tx></dt>
                <dd>
                  {lease.startDate.toISOString().slice(0, 10)} → {lease.endDate ? lease.endDate.toISOString().slice(0, 10) : "open"}
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground"><Tx>Rent / month</Tx></dt>
                <dd className="tabular-nums">{money(lease.rentAmountMinor)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground"><Tx>Billing</Tx></dt>
                <dd>
                  <Tx>day </Tx>{lease.billingCycleDay} · {lease.prorationBasis === "thirty_day" ? "30-day" : "calendar"} <Tx>proration
                </Tx></dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground"><Tx>Deposit</Tx></dt>
                <dd className="tabular-nums">
                  {money(lease.depositTotalMinor)} <Tx>in </Tx>{lease.depositInstallments} <Tx>installment(s)
                </Tx></dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground"><Tx>Notice / renewal</Tx></dt>
                <dd>
                  {lease.noticeDays}<Tx>d · </Tx>{lease.autoRenew ? "auto-renews" : "manual"}
                  {lease.escalationPercent !== null ? ` · +${lease.escalationPercent}%/yr` : ""}
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground"><Tx>Next bill</Tx></dt>
                <dd>{lease.nextBillingDate ? lease.nextBillingDate.toISOString().slice(0, 10) : "— (set on activation)"}</dd>
              </div>
              {lease.terminationReason ? (
                <div className="flex justify-between border-t pt-2">
                  <dt className="text-destructive"><Tx>Terminated</Tx></dt>
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
          catalog={catalog.map((c) => ({
            id: c.id,
            code: c.code,
            name: c.name,
            pricingModel: c.pricingModel,
            unitPriceMinor: c.unitPriceMinor,
            unitLabel: c.unitLabel
          }))}
          parkingSlots={parkingSlots.map((s) => ({ id: s.id, code: s.code, monthlyFeeMinor: s.monthlyFeeMinor }))}
          wifiAccounts={wifiAccounts.map((w) => ({ id: w.id, ssid: w.ssid, speedLabel: w.speedLabel }))}
        />
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        {/* Deposit & Security Collateral Card */}
        <Card>
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-3">
              <div>
                <p className="text-sm font-medium"><Tx>Security Deposit (M10)</Tx></p>
                <p className="text-xs text-muted-foreground"><Tx>Liability tracking & move-out settlement</Tx></p>
              </div>
              {lease.deposit ? (
                <Badge variant={lease.deposit.status === "held" ? "success" : lease.deposit.status === "billed" ? "warning" : "secondary"}>
                  {lease.deposit.status}
                </Badge>
              ) : (
                <Badge variant="outline"><Tx>None</Tx></Badge>
              )}
            </div>

            <dl className="space-y-2 text-sm">
              <div className="flex justify-between">
                <dt className="text-muted-foreground"><Tx>Required deposit</Tx></dt>
                <dd className="font-semibold tabular-nums">{money(lease.depositTotalMinor)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground"><Tx>Collected</Tx></dt>
                <dd className="tabular-nums">{money(depositCollected)}</dd>
              </div>
              <div className="flex justify-between border-t pt-1.5 font-medium">
                <dt className="text-muted-foreground"><Tx>Currently held (2100)</Tx></dt>
                <dd className="tabular-nums text-foreground">{money(depositHeld)}</dd>
              </div>
              {lease.deposit?.invoice ? (
                <div className="flex justify-between border-t pt-1.5 text-xs">
                  <dt className="text-muted-foreground"><Tx>Deposit Invoice</Tx></dt>
                  <dd>
                    <Link href={`/invoices/${lease.deposit.invoice.id}`} className="font-mono underline hover:text-primary">
                      {lease.deposit.invoice.code} ({lease.deposit.invoice.status})
                    </Link>
                  </dd>
                </div>
              ) : null}
            </dl>

            <div className="mt-3 flex justify-end">
              <Link href="/deposits" className="text-xs text-primary underline underline-offset-4">
                <Tx>Open Deposits Module →</Tx>
              </Link>
            </div>
          </CardContent>
        </Card>

        {/* Invoices for this Lease */}
        <Card>
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-3">
              <div>
                <p className="text-sm font-medium"><Tx>Lease Invoices (M07)</Tx></p>
                <p className="text-xs text-muted-foreground"><Tx>Periodic rent, services & deposit billing</Tx></p>
              </div>
              <Badge variant="outline" className="text-xs">
                {lease.invoices.length} invoice(s)
              </Badge>
            </div>

            {lease.invoices.length === 0 ? (
              <p className="py-4 text-center text-xs text-muted-foreground">
                <Tx>No invoices billed yet. Monthly billing runs automatically on day </Tx>{lease.billingCycleDay}.
              </p>
            ) : (
              <ul className="divide-y text-xs">
                {lease.invoices.map((inv) => (
                  <li key={inv.id} className="flex items-center justify-between py-2">
                    <div>
                      <Link href={`/invoices/${inv.id}`} className="font-mono font-medium underline hover:text-primary">
                        {inv.code}
                      </Link>
                      <span className="ml-1.5 text-muted-foreground">
                        {inv.isDeposit ? "(Deposit)" : `${inv.periodStart.toISOString().slice(0, 7)}`}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="tabular-nums font-medium">{money(inv.totalMinor)}</span>
                      <Badge variant={inv.status === "paid" ? "success" : inv.status === "overdue" ? "destructive" : "warning"} className="text-[10px] px-1 py-0">
                        {inv.status}
                      </Badge>
                    </div>
                  </li>
                ))}
              </ul>
            )}

            <div className="mt-3 flex justify-end">
              <Link href={`/invoices?propertyId=${lease.propertyId}`} className="text-xs text-primary underline underline-offset-4">
                <Tx>View all property invoices →</Tx>
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="mt-4">
        <CardContent className="p-5">
          <p className="mb-3 text-sm font-medium"><Tx>Timeline (audit)</Tx></p>
          <ul className="space-y-2.5">
            {activity.length === 0 ? <li className="text-sm text-muted-foreground"><Tx>No entries yet.</Tx></li> : null}
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
        <CardContent className="p-4 text-xs text-muted-foreground"><Tx>
          Effects: activation → room occupied, member active, first invoice scheduled (generation job ships in Phase 6) · ending →
          room cleaning (when last lease in room), member moved_out, deposit settlement triggered (M10 acts from Phase 9) ·
          termination clearance/inspection gates tighten as those modules land.
        </Tx></CardContent>
      </Card>
    </div>
  );
}
