import { prisma } from "@/lib/db";
import { getAuthUser } from "@/lib/auth/session";
import { can, hasModuleAccess } from "@/lib/rbac/can";
import { visiblePropertyScope, propertyInScope } from "@/lib/rbac/propscope";
import { formatMinor } from "@/lib/money";
import { formatMilli } from "@/lib/utilities/machines";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EmptyState, PageHeader, StatCard } from "@/components/ui/misc";
import { ServiceActions } from "./service-actions";

export const dynamic = "force-dynamic";

export default async function ServicesPage() {
  const user = await getAuthUser();
  if (!user || !hasModuleAccess(user, "read", "M12")) {
    return <EmptyState title="No access" hint="Your roles do not include read on Services (M12)." />;
  }
  const scope = await visiblePropertyScope(user, user.permissions, "M12");
  const inScope = (propertyId: string) => propertyInScope(propertyId, scope);
  const canAssign = can(user, "create", "M12");
  const canSuspend = can(user, "update", "M12");

  const [catalog, assignments, usages, slots, wifi] = await Promise.all([
    prisma.serviceCatalog.findMany({ orderBy: { code: "asc" } }),
    prisma.serviceAssignment.findMany({
      include: {
        service: true,
        lease: { include: { member: { include: { party: true } }, room: true } },
        parkingSlot: true,
        wifiAccount: true
      },
      orderBy: { createdAt: "desc" },
      take: 200
    }),
    prisma.serviceUsage.findMany({
      include: { service: true, lease: { include: { member: { include: { party: true } }, room: true } } },
      orderBy: { usedAt: "desc" },
      take: 100
    }),
    prisma.parkingSlot.findMany({ include: { property: true }, orderBy: { code: "asc" } }),
    prisma.wifiAccount.findMany({ include: { property: true }, orderBy: { ssid: "asc" } })
  ]);

  const visibleAssignments = assignments.filter((a) => inScope(a.lease.propertyId));
  const visibleUsages = usages.filter((u) => inScope(u.lease.propertyId));
  const pendingUsageMinor = visibleUsages
    .filter((u) => u.status === "pending")
    .reduce((s, u) => s + Math.round((u.unitPriceMinor * u.qtyMilli) / 1000), 0);

  return (
    <div>
      <PageHeader
        title="Services"
        description="Billable add-ons (§M12) — fixed monthly ride the rent engine (prorated on suspend), per-use rides the next invoice"
      />

      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <StatCard label="Active assignments" value={visibleAssignments.filter((a) => a.status === "active").length} sub={`${visibleAssignments.length} total`} />
        <StatCard label="Pending per-use charges" value={formatMinor(pendingUsageMinor)} sub={`${visibleUsages.filter((u) => u.status === "pending").length} entr(y/ies)`} />
        <StatCard label="Catalog" value={catalog.filter((c) => c.isActive).length} sub={`${slots.length} parking slots · ${wifi.length} WiFi accounts`} />
      </div>

      {canAssign ? (
        <ServiceActions
          catalog={catalog.filter((c) => c.isActive).map((c) => ({ id: c.id, name: `${c.name} (${c.pricingModel})`, pricingModel: c.pricingModel }))}
          slots={slots.filter((s) => s.status === "free").map((s) => ({ code: s.code, label: `${s.code} — ${formatMinor(s.monthlyFeeMinor)}/mo` }))}
          wifi={wifi.filter((w) => w.status === "free").map((w) => ({ ssid: w.ssid, label: w.ssid }))}
          suspendTarget={null}
          usageTarget={null}
        />
      ) : null}

      <Card className="mb-6">
        <CardContent className="p-0">
          <div className="border-b p-4 text-sm font-semibold">Assignments</div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Service</TableHead>
                <TableHead>Lease</TableHead>
                <TableHead>Binding</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Since</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {visibleAssignments.map((a) => (
                <TableRow key={a.id}>
                  <TableCell>
                    {a.service.name}
                    <span className="block text-xs text-muted-foreground">
                      {formatMinor(a.service.unitPriceMinor)}
                      {a.service.pricingModel === "fixed_monthly" ? "/mo" : a.service.unitLabel ? `/${a.service.unitLabel}` : ""}
                    </span>
                  </TableCell>
                  <TableCell>
                    <a href={`/leases/${a.leaseId}`} className="font-mono text-xs underline underline-offset-4">
                      {a.lease.code}
                    </a>
                    <span className="block text-xs text-muted-foreground">
                      {a.lease.member.party.name} · room {a.lease.room.number}
                    </span>
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {a.parkingSlot ? `slot ${a.parkingSlot.code}` : a.wifiAccount ? `WiFi ${a.wifiAccount.ssid}` : a.service.pricingModel}
                  </TableCell>
                  <TableCell>
                    <Badge variant={a.status === "active" ? "success" : a.status === "suspended" ? "warning" : "secondary"}>{a.status}</Badge>
                  </TableCell>
                  <TableCell className="text-xs">{a.startDate.toISOString().slice(0, 10)}</TableCell>
                  <TableCell className="text-right">
                    <ServiceActions
                      suspendTarget={a.status === "active" && canSuspend ? { id: a.id } : null}
                      usageTarget={
                        canAssign && a.status === "active" && a.service.pricingModel === "per_use"
                          ? { leaseId: a.leaseId, serviceId: a.serviceId, unitLabel: a.service.unitLabel ?? "unit" }
                          : null
                      }
                      catalog={[]}
                      slots={[]}
                      wifi={[]}
                    />
                  </TableCell>
                </TableRow>
              ))}
              {visibleAssignments.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="py-8 text-center text-sm text-muted-foreground">
                    No assignments — assign a catalog service to an active lease (WiFi / parking bind real resources).
                  </TableCell>
                </TableRow>
              ) : null}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardContent className="p-0">
            <div className="border-b p-4 text-sm font-semibold">Catalog</div>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Code</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Model</TableHead>
                  <TableHead className="text-right">Price</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {catalog.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell className="font-mono text-xs">{c.code}</TableCell>
                    <TableCell>
                      {c.name}
                      {c.isActive ? "" : <Badge variant="secondary" className="ml-1">off</Badge>}
                    </TableCell>
                    <TableCell className="text-xs">{c.pricingModel}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatMinor(c.unitPriceMinor)}
                      {c.unitLabel ? (
                        <span className="text-xs text-muted-foreground">/{c.unitLabel}</span>
                      ) : c.pricingModel === "fixed_monthly" ? (
                        <span className="text-xs text-muted-foreground">/mo</span>
                      ) : null}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-0">
            <div className="border-b p-4 text-sm font-semibold">Per-use entries</div>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Service</TableHead>
                  <TableHead>Lease</TableHead>
                  <TableHead className="text-right">Qty</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {visibleUsages.slice(0, 8).map((u) => (
                  <TableRow key={u.id}>
                    <TableCell>{u.service.name}</TableCell>
                    <TableCell className="font-mono text-xs">{u.lease.code}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatMilli(u.qtyMilli)} {u.unitLabel ?? ""}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{formatMinor(Math.round((u.unitPriceMinor * u.qtyMilli) / 1000))}</TableCell>
                    <TableCell>
                      <Badge variant={u.status === "billed" ? "success" : "secondary"}>{u.status}</Badge>
                    </TableCell>
                  </TableRow>
                ))}
                {visibleUsages.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="py-6 text-center text-sm text-muted-foreground">
                      No per-use entries yet.
                    </TableCell>
                  </TableRow>
                ) : null}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Card>
          <CardContent className="p-0">
            <div className="border-b p-4 text-sm font-semibold">Parking slots</div>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Slot</TableHead>
                  <TableHead>Property</TableHead>
                  <TableHead className="text-right">Monthly</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {slots.map((s) => (
                  <TableRow key={s.id}>
                    <TableCell className="font-mono text-xs">{s.code}</TableCell>
                    <TableCell>{s.property.name}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatMinor(s.monthlyFeeMinor)}</TableCell>
                    <TableCell>
                      <Badge variant={s.status === "free" ? "secondary" : "success"}>{s.status}</Badge>
                    </TableCell>
                  </TableRow>
                ))}
                {slots.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="py-6 text-center text-sm text-muted-foreground">
                      No parking slots yet.
                    </TableCell>
                  </TableRow>
                ) : null}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-0">
            <div className="border-b p-4 text-sm font-semibold">WiFi accounts</div>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>SSID</TableHead>
                  <TableHead>Property</TableHead>
                  <TableHead>Speed</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {wifi.map((w) => (
                  <TableRow key={w.id}>
                    <TableCell className="font-mono text-xs">{w.ssid}</TableCell>
                    <TableCell>{w.property.name}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{w.speedLabel ?? "—"}</TableCell>
                    <TableCell>
                      <Badge variant={w.status === "assigned" ? "success" : w.status === "suspended" ? "warning" : "secondary"}>{w.status}</Badge>
                    </TableCell>
                  </TableRow>
                ))}
                {wifi.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="py-6 text-center text-sm text-muted-foreground">
                      No WiFi accounts yet.
                    </TableCell>
                  </TableRow>
                ) : null}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
