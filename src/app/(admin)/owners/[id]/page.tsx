import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { getAuthUser } from "@/lib/auth/session";
import { can } from "@/lib/rbac/can";
import { loadOwnerGuardTarget } from "@/lib/owners";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/misc";
import { OwnerTabs } from "./owner-tabs";
import { timeAgo } from "@/lib/utils";
import { Tx } from "@/components/i18n-text";

export const dynamic = "force-dynamic";

export default async function OwnerDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getAuthUser();
  if (!user) notFound();

  const target = await loadOwnerGuardTarget(id);
  if (!target) notFound();

  // OWN scope: the bound owner user may view; everyone else needs read + scope.
  if (!can(user, "read", "M03", { ownerUserId: target.ownerUserId })) {
    return <EmptyState title="No access to this owner" hint="Owners can only view their own record (OWN scope)." />;
  }

  const owner = await prisma.ownerProfile.findUnique({
    where: { id },
    include: {
      party: { include: { users: { take: 1 } } },
      payoutMethods: { orderBy: [{ isPrimary: "desc" }, { createdAt: "asc" }] },
      buildings: { include: { property: true, floors: { include: { rooms: { select: { status: true } } } } } }
    }
  });
  if (!owner) notFound();

  const documents = await prisma.documentRegistry.findMany({
    where: { entity: "OWNER", entityId: id },
    include: { docType: true },
    orderBy: [{ docTypeId: "asc" }, { version: "desc" }]
  });
  const docTypes = await prisma.docType.findMany({ orderBy: { sortOrder: "asc" } });

  const unownedBuildings = await prisma.building.findMany({
    where: { ownerId: null },
    include: { property: true },
    orderBy: { name: "asc" }
  });

  const activity = await prisma.auditLog.findMany({
    where: { entityType: { in: ["owner", "owner_buildings", "owner_payout_method", "owner_login"] }, entityId: { in: [id] } },
    orderBy: { createdAt: "desc" },
    take: 15
  });

  const buildingViews = owner.buildings.map((b) => {
    const rooms = b.floors.flatMap((f) => f.rooms);
    const occupied = rooms.filter((r) => r.status === "occupied").length;
    return {
      id: b.id,
      label: `${b.property.code} / ${b.name}`,
      floors: b.floors.length,
      rooms: rooms.length,
      occupied
    };
  });

  return (
    <div>
      <div className="mb-4 text-sm text-muted-foreground">
        <Link href="/owners" className="underline underline-offset-4 hover:text-foreground">
          <Tx>Owners</Tx>
        </Link>{" "}
        / <span className="text-foreground">{owner.party.name}</span>
      </div>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
            {owner.party.name}
            <Badge variant={owner.status === "active" ? "success" : "secondary"}>{owner.status}</Badge>
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {owner.companyName ? `${owner.companyName} · ` : ""}
            {owner.party.email ?? "no email"} · {owner.party.phone ?? "no phone"}
          </p>
        </div>
        {target.ownerUserId ? (
          <Badge variant="info">portal: {owner.party.users[0]?.email}</Badge>
        ) : (
          <Badge variant="outline">no portal login</Badge>
        )}
      </div>

      <OwnerTabs
        ownerId={id}
        profile={{
          name: owner.party.name,
          email: owner.party.email,
          phone: owner.party.phone,
          companyName: owner.companyName,
          notes: owner.notes,
          status: owner.status
        }}
        payoutMethods={owner.payoutMethods.map((m) => ({
          id: m.id,
          kind: m.kind,
          bankName: m.bankName,
          accountName: m.accountName,
          accountNumber: m.accountNumber,
          isPrimary: m.isPrimary,
          notes: m.notes
        }))}
        buildings={buildingViews}
        unownedBuildings={unownedBuildings.map((b) => ({ id: b.id, label: `${b.property.code} / ${b.name}` }))}
        portalEmail={owner.party.users[0]?.email ?? null}
        documents={documents.map((d) => ({
          id: d.id,
          docTypeId: d.docTypeId,
          docTypeName: d.docType.name,
          fileName: d.fileName,
          sizeBytes: d.sizeBytes,
          version: d.version,
          expiryDate: d.expiryDate ? d.expiryDate.toISOString() : null,
          createdAt: d.createdAt.toISOString()
        }))}
        docTypes={docTypes.map((d) => ({ id: d.id, name: d.name }))}
        flags={{
          canUpdate: can(user, "update", "M03", { ownerUserId: target.ownerUserId }),
          canReadDocs: can(user, "read", "M17", { ownerUserId: target.ownerUserId }),
          canUploadDocs: can(user, "create", "M17", { ownerUserId: target.ownerUserId })
        }}
        activity={
          <ul className="space-y-2.5">
            {activity.length === 0 ? <li className="text-sm text-muted-foreground"><Tx>No activity recorded yet.</Tx></li> : null}
            {activity.map((a) => (
              <li key={a.id} className="flex items-start justify-between gap-3 text-sm">
                <div>
                  <p>{a.summary}</p>
                  <p className="text-xs text-muted-foreground">
                    {a.actorName} · {a.module}
                  </p>
                </div>
                <span className="shrink-0 text-xs text-muted-foreground">{timeAgo(a.createdAt)}</span>
              </li>
            ))}
          </ul>
        }
      />

      <Card className="mt-6">
        <CardContent className="p-4 text-xs text-muted-foreground"><Tx>
          Rules: a building links to exactly one owner (the contract terms arrive with M05 owner contracts in Phase 5). Account
          numbers are masked in lists; every payout-method change is audited.
        </Tx></CardContent>
      </Card>
    </div>
  );
}
