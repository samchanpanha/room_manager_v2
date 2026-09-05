import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { getAuthUser } from "@/lib/auth/session";
import { can } from "@/lib/rbac/can";
import { PageHeader } from "@/components/ui/misc";
import { NewOwnerForm } from "./new-owner-form";
import { Tx } from "@/components/i18n-text";

export const dynamic = "force-dynamic";

export default async function NewOwnerPage() {
  const user = await getAuthUser();
  if (!user) redirect("/login");
  if (!can(user, "create", "M03")) {
    return (
      <div>
        <PageHeader title="New owner" />
        <p className="text-sm text-destructive"><Tx>Your roles do not include create on Owners (M03).</Tx></p>
      </div>
    );
  }

  const buildings = await prisma.building.findMany({
    where: { ownerId: null },
    include: { property: true },
    orderBy: { name: "asc" }
  });

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        title="New owner"
        description="M03 — landlord record, payout method, optional portal login and building ownership"
      />
      <NewOwnerForm
        unownedBuildings={buildings.map((b) => ({ id: b.id, label: `${b.property.code} / ${b.name}` }))}
      />
    </div>
  );
}
