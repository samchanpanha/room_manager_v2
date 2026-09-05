import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requireMember, memberDashboard, memberRentDue } from "@/lib/portal";
import { getT } from "@/lib/locale-server";

const money = (minor: number) => `$${(minor / 100).toFixed(2)}`;

/// §M25 dashboard — room, lease, balance, deposit, open requests, announcements.
/// Resident-facing copy follows the active locale (en / km / zh) via getT().
export default async function PortalDashboardPage() {
  const [{ member }, { tUi }] = await Promise.all([requireMember(), getT()]);
  const { lease, balanceMinor, deposit, openTickets, openComplaints, announcements, pendingMove } = await memberDashboard(member.id);
  const rentDue = await memberRentDue(member.id);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-lg font-semibold tracking-tight">
          {tUi("Hi")}, {member.name.split(" ")[0]}
        </h1>
        <p className="text-xs text-muted-foreground">
          {member.status === "active" ? tUi("Your tenancy is active") : `${tUi("Status")}: ${tUi(member.status)}`}
          {member.kycCompletedAt ? ` · ${tUi("KYC complete")}` : ` · ${tUi("KYC incomplete")}`}
        </p>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Balance due</CardTitle>
        </CardHeader>
        <CardContent className="flex items-center justify-between">
          <span className={`text-2xl font-semibold tabular-nums ${balanceMinor > 0 ? "text-destructive" : "text-success"}`}>{money(balanceMinor)}</span>
          <Link href="/portal/invoices" className="text-sm underline underline-offset-4">
            {balanceMinor > 0 ? tUi("Pay now →") : tUi("View invoices →")}
          </Link>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Rent repayment</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {rentDue.rows.length === 0 ? (
            <p className="text-sm text-muted-foreground">{tUi("No rent invoice is due right now.")}</p>
          ) : (
            <ul className="space-y-1.5 text-sm">
              {rentDue.rows.slice(0, 3).map((r) => (
                <li key={r.code} className="flex items-center justify-between gap-3">
                  <span className="min-w-0 truncate">
                    {r.code}
                    <span className="text-xs text-muted-foreground"> · {r.dueDate ?? tUi("no due date")}</span>
                  </span>
                  <span className="shrink-0 tabular-nums">
                    {money(r.amountDueMinor)}{" "}
                    <Badge variant={r.daysUntil < 0 ? "destructive" : r.daysUntil <= 3 ? "warning" : "secondary"}>
                      {r.daysUntil < 0
                        ? tUi("{n}d late").replace("{n}", String(Math.abs(r.daysUntil)))
                        : r.daysUntil === 0
                          ? tUi("due today")
                          : tUi("in {n}d").replace("{n}", String(r.daysUntil))}
                    </Badge>
                  </span>
                </li>
              ))}
            </ul>
          )}
          <Link href="/portal/invoices" className="inline-block text-xs underline underline-offset-4">
            {tUi("All invoices →")}
          </Link>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">My room</CardTitle>
        </CardHeader>
        <CardContent className="space-y-1 text-sm">
          {lease ? (
            <>
              <p className="font-medium">
                {tUi("Room")} {lease.room.number} · {tUi("Floor")} {lease.room.floor.name} · {lease.room.floor.building.name}
              </p>
              <p className="text-xs text-muted-foreground">
                {lease.room.floor.building.property.name} · {tUi("lease")} {lease.code} ({tUi(lease.status)}) ·{" "}
                {tUi("since")} {lease.startDate.toISOString().slice(0, 10)}
                {lease.endDate ? ` · ${tUi("until")} ${lease.endDate.toISOString().slice(0, 10)}` : ""}
              </p>
            </>
          ) : (
            <p className="text-muted-foreground">{tUi("No active lease — contact reception.")}</p>
          )}
          {deposit ? (
            <p className="text-xs text-muted-foreground">
              {tUi("Deposit")}: {money(deposit.requiredMinor)} ({tUi(deposit.status)})
            </p>
          ) : null}
          {pendingMove ? <p className="text-xs text-warning">{tUi("Room-move request pending approval.")}</p> : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">My requests</CardTitle>
        </CardHeader>
        <CardContent className="flex gap-2 text-sm">
          <Badge variant={openTickets > 0 ? "warning" : "secondary"}>{openTickets} {tUi("open tickets")}</Badge>
          <Badge variant={openComplaints > 0 ? "warning" : "secondary"}>{openComplaints} {tUi("open complaints")}</Badge>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Announcements</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {announcements.length === 0 ? (
            <p className="text-sm text-muted-foreground">{tUi("Nothing new right now.")}</p>
          ) : (
            announcements.map((a) => (
              <div key={a.id}>
                <p className="text-sm font-medium">{a.title}</p>
                <p className="text-xs text-muted-foreground">{a.body}</p>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
