import Link from "next/link";
import { prisma } from "@/lib/db";
import { getAuthUser } from "@/lib/auth/session";
import { getOwnerLinkForUser } from "@/lib/owners";
import { Badge } from "@/components/ui/badge";
import { TelegramCard } from "@/components/telegram-card";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState, PageHeader, StatCard } from "@/components/ui/misc";
import { timeAgo } from "@/lib/utils";
import { Tx } from "@/components/i18n-text";

export const dynamic = "force-dynamic";

export default async function OwnerPortalPage() {
  const user = await getAuthUser();
  if (!user) {
    return <EmptyState title="Sign in required" />;
  }

  const link = await getOwnerLinkForUser(user);
  if (!link) {
    return (
      <div>
        <PageHeader title="Owner Portal" />
        <EmptyState
          title="No owner record linked to your login"
          hint="This portal is for users holding the OWNER role with a bound owner profile. Ask an administrator to link your account."
        />
      </div>
    );
  }

  const owner = await prisma.ownerProfile.findUnique({
    where: { id: link.ownerProfileId },
    include: {
      party: true,
      payoutMethods: { orderBy: [{ isPrimary: "desc" }, { createdAt: "asc" }] },
      buildings: {
        include: {
          property: true,
          floors: { include: { rooms: { select: { status: true, basePriceMinor: true } } } }
        }
      }
    }
  });
  if (!owner) return <EmptyState title="Owner record not found" />;

  const documents = await prisma.documentRegistry.findMany({
    where: { entity: "OWNER", entityId: owner.id },
    include: { docType: true },
    orderBy: { createdAt: "desc" },
    take: 6
  });

  const statements = await prisma.ownerStatement.findMany({
    where: { ownerProfileId: owner.id },
    orderBy: [{ month: "desc" }, { code: "asc" }],
    take: 6
  });

  const rooms = owner.buildings.flatMap((b) => b.floors.flatMap((f) => f.rooms));
  const occupied = rooms.filter((r) => r.status === "occupied").length;
  const monthlyBook = rooms.reduce((s, r) => s + r.basePriceMinor, 0);
  const primary = owner.payoutMethods.find((m) => m.isPrimary) ?? owner.payoutMethods[0];

  return (
    <div>
      <PageHeader
        title={`Welcome, ${owner.party.name}`}
        description="Owner portal — your buildings, occupancy, documents and payouts"
        actions={<Badge variant="secondary">{owner.status}</Badge>}
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Buildings" value={owner.buildings.length} />
        <StatCard label="Rooms" value={rooms.length} sub={`${occupied} occupied`} />
        <StatCard
          label="Occupancy"
          value={`${rooms.length > 0 ? Math.round((occupied / rooms.length) * 100) : 0}%`}
        />
        <StatCard
          label="Monthly book value"
          value={`$${(monthlyBook / 100).toLocaleString()}`}
          sub="Σ room base prices"
        />
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Your buildings</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="divide-y">
              {owner.buildings.map((b) => {
                const brooms = b.floors.flatMap((f) => f.rooms);
                const bocc = brooms.filter((r) => r.status === "occupied").length;
                return (
                  <li key={b.id} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                    <div>
                      <p className="font-medium">{b.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {b.property.name} · {b.floors.length} <Tx>floors · </Tx>{brooms.length} <Tx>rooms
                      </Tx></p>
                    </div>
                    <Badge variant={bocc > 0 ? "success" : "secondary"}>
                      {brooms.length > 0 ? Math.round((bocc / brooms.length) * 100) : 0}%
                    </Badge>
                  </li>
                );
              })}
              {owner.buildings.length === 0 ? (
                <li className="py-3 text-sm text-muted-foreground"><Tx>No buildings assigned to you yet.</Tx></li>
              ) : null}
            </ul>
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Payout details</CardTitle>
            </CardHeader>
            <CardContent className="text-sm">
              {primary ? (
                <p>
                  {primary.kind}
                  {primary.bankName ? ` · ${primary.bankName}` : ""} · {primary.accountName} · ••••
                  {primary.accountNumber.slice(-4)}
                </p>
              ) : (
                <p className="text-muted-foreground"><Tx>No payout method on file.</Tx></p>
              )}
              <p className="mt-1 text-xs text-muted-foreground">
                <Tx>Owner statements (M24) arrive in Phase 17 — payouts will land here.</Tx>
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Recent documents</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="divide-y">
                {documents.map((d) => (
                  <li key={d.id} className="flex items-center justify-between gap-3 py-2 text-sm">
                    <div>
                      <p className="font-medium">{d.docType.name}</p>
                      <p className="text-xs text-muted-foreground">{d.fileName}</p>
                    </div>
                    <span className="text-xs text-muted-foreground">{timeAgo(d.createdAt)}</span>
                  </li>
                ))}
                {documents.length === 0 ? (
                  <li className="py-3 text-sm text-muted-foreground"><Tx>No documents yet.</Tx></li>
                ) : null}
              </ul>
            </CardContent>
          </Card>
        </div>
      </div>

      <div className="mt-6 max-w-md">
        <TelegramCard />
      </div>

      {statements.length > 0 ? (
        <Card className="mt-6">
          <CardHeader>
            <CardTitle className="text-base">Your statements (M24)</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="divide-y text-sm">
              {statements.map((st) => (
                <li key={st.id} className="flex items-center justify-between py-2">
                  <span>
                    <span className="font-mono text-xs">{st.code}</span> · {st.month} <Tx>· net $=</Tx>{(st.netMinor / 100).toFixed(2)}
                  </span>
                  <span className="flex items-center gap-2">
                    <Badge variant={st.status === "paid" ? "success" : st.status === "approved" ? "info" : "warning"}>{st.status}</Badge>
                    {st.status !== "draft" ? (
                      <Link href={`/api/statements/${st.id}/pdf`} target="_blank" className="text-xs underline underline-offset-4">
                        <Tx>PDF</Tx>
                      </Link>
                    ) : null}
                  </span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      ) : null}

      <p className="mt-6 text-xs text-muted-foreground">
        <Tx>You are seeing only buildings owned by you — enforced server-side (OWN scope).</Tx>{" "}
        <Link href="/properties" className="underline underline-offset-4">
          <Tx>Browse your properties →</Tx>
        </Link>
      </p>
    </div>
  );
}
