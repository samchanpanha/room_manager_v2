import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requireMember, memberDashboard, memberRentDue } from "@/lib/portal";

const money = (minor: number) => `$${(minor / 100).toFixed(2)}`;

/// §M25 dashboard — room, lease, balance, deposit, open requests, announcements.
export default async function PortalDashboardPage() {
  const { member } = await requireMember();
  const { lease, balanceMinor, deposit, openTickets, openComplaints, announcements, pendingMove } = await memberDashboard(member.id);
  const rentDue = await memberRentDue(member.id);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-lg font-semibold tracking-tight">Hi, {member.name.split(" ")[0]}</h1>
        <p className="text-xs text-muted-foreground">
          {member.status === "active" ? "Your tenancy is active" : `Status: ${member.status}`}
          {member.kycCompletedAt ? " · KYC complete" : " · KYC incomplete"}
        </p>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Balance due</CardTitle>
        </CardHeader>
        <CardContent className="flex items-center justify-between">
          <span className={`text-2xl font-semibold tabular-nums ${balanceMinor > 0 ? "text-destructive" : "text-success"}`}>{money(balanceMinor)}</span>
          <Link href="/portal/invoices" className="text-sm underline underline-offset-4">
            {balanceMinor > 0 ? "Pay now →" : "View invoices →"}
          </Link>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Rent repayment</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {rentDue.rows.length === 0 ? (
            <p className="text-sm text-muted-foreground">No rent invoice is due right now.</p>
          ) : (
            <ul className="space-y-1.5 text-sm">
              {rentDue.rows.slice(0, 3).map((r) => (
                <li key={r.code} className="flex items-center justify-between gap-3">
                  <span className="min-w-0 truncate">
                    {r.code}
                    <span className="text-xs text-muted-foreground"> · {r.dueDate ?? "no due date"}</span>
                  </span>
                  <span className="shrink-0 tabular-nums">
                    {money(r.amountDueMinor)}{" "}
                    <Badge variant={r.daysUntil < 0 ? "destructive" : r.daysUntil <= 3 ? "warning" : "secondary"}>
                      {r.daysUntil < 0 ? `${Math.abs(r.daysUntil)}d late` : r.daysUntil === 0 ? "due today" : `in ${r.daysUntil}d`}
                    </Badge>
                  </span>
                </li>
              ))}
            </ul>
          )}
          <Link href="/portal/invoices" className="inline-block text-xs underline underline-offset-4">
            All invoices →
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
                Room {lease.room.number} · Floor {lease.room.floor.name} · {lease.room.floor.building.name}
              </p>
              <p className="text-xs text-muted-foreground">
                {lease.room.floor.building.property.name} · lease {lease.code} ({lease.status}) · since {lease.startDate.toISOString().slice(0, 10)}
                {lease.endDate ? ` · until ${lease.endDate.toISOString().slice(0, 10)}` : ""}
              </p>
            </>
          ) : (
            <p className="text-muted-foreground">No active lease — contact reception.</p>
          )}
          {deposit ? (
            <p className="text-xs text-muted-foreground">
              Deposit: {money(deposit.requiredMinor)} ({deposit.status})
            </p>
          ) : null}
          {pendingMove ? <p className="text-xs text-warning">Room-move request pending approval.</p> : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">My requests</CardTitle>
        </CardHeader>
        <CardContent className="flex gap-2 text-sm">
          <Badge variant={openTickets > 0 ? "warning" : "secondary"}>{openTickets} open tickets</Badge>
          <Badge variant={openComplaints > 0 ? "warning" : "secondary"}>{openComplaints} open complaints</Badge>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Announcements</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {announcements.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nothing new right now.</p>
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
