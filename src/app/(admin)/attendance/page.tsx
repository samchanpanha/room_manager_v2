import { prisma } from "@/lib/db";
import { getAuthUser } from "@/lib/auth/session";
import { can, hasModuleAccess } from "@/lib/rbac/can";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EmptyState, PageHeader } from "@/components/ui/misc";
import { AttendanceAdmin, KioskCard } from "./attendance-actions";
import { Tx } from "@/components/i18n-text";

export const dynamic = "force-dynamic";

const MIN = (d: Date | null) => (d ? Math.round((d.getTime() - 0) / 60_000) : null);

export default async function AttendancePage() {
  const user = await getAuthUser();
  if (!user || !hasModuleAccess(user, "read", "M23")) {
    return <EmptyState title="No access" hint="Your roles do not include read on Attendance (M23)." />;
  }

  // GLOBAL readers see every property; otherwise their assignments (§5 scope).
  const globalRead = can(user, "read", "M23");
  const properties = await prisma.property.findMany({
    where: globalRead ? { status: "active" } : { id: { in: user.propertyIds.length > 0 ? user.propertyIds : ["—"] } },
    select: { id: true, code: true, name: true },
    orderBy: { code: "asc" }
  });
  const propIds = properties.map((p) => p.id);

  const now = new Date();
  const monthFrom = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const monthTo = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
  const month = monthFrom.toISOString().slice(0, 7);

  // Own-scope (Staff O(clock)) sees only their rows.
  const ownOnly = propIds.length > 0 && !can(user, "read", "M23", { propertyId: propIds[0] });
  const records = ownOnly
    ? await prisma.attendanceRecord.findMany({
        where: { userId: user.id, workDate: { gte: monthFrom, lt: monthTo } },
        include: { user: { select: { name: true, email: true } }, shift: true, exceptions: true },
        orderBy: [{ workDate: "desc" }, { clockInAt: "asc" }]
      })
    : await prisma.attendanceRecord.findMany({
        where: { propertyId: { in: propIds }, workDate: { gte: monthFrom, lt: monthTo } },
        include: { user: { select: { name: true, email: true } }, shift: true, exceptions: true },
        orderBy: [{ workDate: "desc" }, { clockInAt: "asc" }]
      });

  const openPunches = await prisma.attendanceRecord.count({ where: { clockOutAt: null, ...(ownOnly ? { userId: user.id } : { propertyId: { in: propIds } }) } });
  const openExceptions = await prisma.attendanceException.findMany({
    where: { status: "open", ...(ownOnly ? { userId: user.id } : { propertyId: { in: propIds } }) },
    include: { user: { select: { name: true, email: true } } },
    orderBy: { workDate: "desc" },
    take: 50
  });

  const canUpdate = can(user, "update", "M23");
  const staff = canUpdate
    ? await prisma.user.findMany({ where: { status: "active" }, select: { id: true, name: true, email: true }, orderBy: { name: "asc" } })
    : [];
  const firstProp = propIds[0] ?? null;
  void MIN;

  const monthMinutes = records.reduce((s, r) => s + (r.minutesWorked ?? 0), 0);
  const monthOt = records.reduce((s, r) => s + (r.overtimeMinutes ?? 0), 0);

  return (
    <div>
      <PageHeader
        title="Attendance"
        description="M23 — clock in/out via kiosk PIN or mobile (optional geofence); audited corrections; exception report flags missed punches; monthly summary + CSV payroll export"
      />

      <div className="mb-4 flex flex-wrap gap-3 text-sm">
        <Badge variant={openPunches > 0 ? "warning" : "outline"}>open punches: {openPunches}</Badge>
        <Badge variant={openExceptions.length > 0 ? "destructive" : "success"}>open exceptions: {openExceptions.length}</Badge>
        <Badge variant="info">this month: {Math.floor(monthMinutes / 60)}h {monthMinutes % 60}m · OT {monthOt}m</Badge>
        <Badge variant="outline">{month}</Badge>
      </div>

      <KioskCard
        properties={properties.map((p) => ({ id: p.id, label: `${p.code} · ${p.name}` }))}
        isStaff={can(user, "create", "M23", { ownerUserId: user.id })}
      />

      {canUpdate ? (
        <AttendanceAdmin
          properties={properties.map((p) => ({ id: p.id, label: `${p.code} · ${p.name}` }))}
          staff={staff.map((s) => ({ id: s.id, label: `${s.name} (${s.email})` }))}
          month={month}
          firstPropertyId={firstProp}
          records={records.map((r) => ({
            id: r.id,
            label: `${r.workDate.toISOString().slice(0, 10)} · ${r.user.name} · in ${r.clockInAt.toISOString().slice(11, 16)} · out ${r.clockOutAt ? r.clockOutAt.toISOString().slice(11, 16) : "—"}`,
            clockInAt: r.clockInAt.toISOString(),
            clockOutAt: r.clockOutAt?.toISOString() ?? null
          }))}
          exceptions={openExceptions.map((e) => ({ id: e.id, label: `${e.type} · ${e.user.name} · ${e.detail}` }))}
        />
      ) : null}

      <Card className="mt-4">
        <CardContent className="p-0">
          <div className="border-b p-3 text-sm font-semibold"><Tx>Records — </Tx>{month}</div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Staff</TableHead>
                <TableHead>Shift</TableHead>
                <TableHead>In → Out</TableHead>
                <TableHead className="text-right">Minutes</TableHead>
                <TableHead className="text-right">OT</TableHead>
                <TableHead>Source</TableHead>
                <TableHead>Exceptions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {records.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="text-xs">{r.workDate.toISOString().slice(0, 10)}</TableCell>
                  <TableCell className="text-xs">
                    {r.user.name}
                    {r.editedAt ? (
                      <Badge variant="secondary" className="ml-1">
                        edited
                      </Badge>
                    ) : null}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">{r.shift?.name ?? "—"}</TableCell>
                  <TableCell className="text-xs tabular-nums">
                    {r.clockInAt.toISOString().slice(11, 16)} → {r.clockOutAt ? r.clockOutAt.toISOString().slice(11, 16) : <Badge variant="warning">open</Badge>}
                  </TableCell>
                  <TableCell className="text-right tabular-nums text-xs">{r.minutesWorked ?? "—"}</TableCell>
                  <TableCell className="text-right tabular-nums text-xs">{r.overtimeMinutes ? `+${r.overtimeMinutes}` : "—"}</TableCell>
                  <TableCell>
                    <Badge variant={r.source === "manual" ? "secondary" : "outline"}>{r.source}</Badge>
                  </TableCell>
                  <TableCell className="text-xs">
                    {r.exceptions.length === 0
                      ? "—"
                      : r.exceptions.map((e) => (
                          <Badge key={e.id} variant={e.status === "open" ? "destructive" : "success"} className="mr-1">
                            {e.type}
                          </Badge>
                        ))}
                  </TableCell>
                </TableRow>
              ))}
              {records.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="py-8 text-center text-sm text-muted-foreground"><Tx>
                    No punches this month yet — clock in via the kiosk above.
                  </Tx></TableCell>
                </TableRow>
              ) : null}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card className="mt-6">
        <CardContent className="p-0">
          <div className="border-b p-3 text-sm font-semibold"><Tx>Exception report (open)</Tx></div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Staff</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Detail</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {openExceptions.map((e) => (
                <TableRow key={e.id}>
                  <TableCell className="text-xs">{e.workDate.toISOString().slice(0, 10)}</TableCell>
                  <TableCell className="text-xs">{e.user.name}</TableCell>
                  <TableCell>
                    <Badge variant="destructive">{e.type}</Badge>
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">{e.detail}</TableCell>
                </TableRow>
              ))}
              {openExceptions.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="py-8 text-center text-sm text-muted-foreground">
                    <Tx>No open exceptions.</Tx>
                  </TableCell>
                </TableRow>
              ) : null}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <p className="mt-3 text-xs text-muted-foreground">
        <Tx>Punches never bypass the record: corrections are separate audited edits with a mandatory reason (edited badge), the daily
        sweep flags open punches older than 16h as missed_clock_out, and the CSV export mirrors the records one row per punch pair.</Tx>
      </p>
    </div>
  );
}
