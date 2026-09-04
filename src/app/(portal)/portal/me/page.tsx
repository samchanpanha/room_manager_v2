import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requireMember } from "@/lib/portal";
import { TelegramCard } from "@/components/telegram-card";
import { LogoutButton } from "./logout-button";

const money = (minor: number | null | undefined) => (minor == null ? "—" : `$${(minor / 100).toFixed(2)}`);

/// §M25 profile — identity, tenancy status, KYC chip, deposit, sign out.
export default async function PortalMePage() {
  const { member } = await requireMember();
  const deposit = await (await import("@/lib/portal")).memberDeposit(member.id);

  return (
    <div className="space-y-4">
      <h1 className="text-lg font-semibold tracking-tight">My profile</h1>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-1.5 text-sm">
          <p className="font-medium">{member.name}</p>
          <p className="text-muted-foreground">{member.email ?? "—"}</p>
          <p className="text-muted-foreground">{member.phone ?? "—"}</p>
          <div className="flex gap-2 pt-1">
            <Badge variant="secondary">{member.status}</Badge>
            <Badge variant={member.kycCompletedAt ? "success" : "warning"}>{member.kycCompletedAt ? "KYC complete" : "KYC pending"}</Badge>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Deposit</CardTitle>
        </CardHeader>
        <CardContent className="text-sm">
          {deposit ? (
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">{money(deposit.requiredMinor)}</span>
              <Badge variant={deposit.status === "held" || deposit.status === "settled" ? "success" : "warning"}>{deposit.status}</Badge>
            </div>
          ) : (
            <p className="text-muted-foreground">No deposit on file.</p>
          )}
        </CardContent>
      </Card>

      <TelegramCard />

      <LogoutButton />
    </div>
  );
}
