import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { getAuthUser } from "@/lib/auth/session";
import { can } from "@/lib/rbac/can";
import { PageHeader } from "@/components/ui/misc";
import { OwnerContractForm } from "./owner-contract-form";
import { Tx } from "@/components/i18n-text";

export const dynamic = "force-dynamic";

export default async function NewOwnerContractPage() {
  const user = await getAuthUser();
  if (!user) redirect("/login");
  if (!can(user, "create", "M05")) {
    return (
      <div>
        <PageHeader title="New owner contract" />
        <p className="text-sm text-destructive"><Tx>Your roles do not include create on Leases (M05).</Tx></p>
      </div>
    );
  }

  const [owners, buildings] = await Promise.all([
    prisma.ownerProfile.findMany({ include: { party: true }, orderBy: { createdAt: "asc" } }),
    prisma.building.findMany({
      include: { property: true, owner: { include: { party: true } }, contracts: { where: { status: { in: ["draft", "active"] } } } },
      orderBy: { name: "asc" }
    })
  ]);

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader
        title="New owner contract"
        description="M05 — master rent or revenue-share agreement per building; activation syncs building ownership"
      />
      <OwnerContractForm
        owners={owners.map((o) => ({ id: o.id, label: o.party.name }))}
        buildings={buildings
          .filter((b) => b.contracts.length === 0)
          .map((b) => ({
            id: b.id,
            label: `${b.property.code}/${b.name}${b.owner ? ` (owner: ${b.owner.party.name})` : " (unowned)"}`
          }))}
      />
    </div>
  );
}
