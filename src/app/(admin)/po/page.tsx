import { redirect } from "next/navigation";
import { getAuthUser } from "@/lib/auth/session";
import { hasModuleAccess, can } from "@/lib/rbac/can";
import { prisma } from "@/lib/db";
import { PageHeader, EmptyState } from "@/components/ui/misc";
import { PoManager } from "./po-manager";

export const dynamic = "force-dynamic";

/// M29 Purchase Orders — plan and track stock purchases against the M15
/// movement engine. Reads for R+, operations for W/M roles on their property.
export default async function PoPage() {
  const user = await getAuthUser();
  if (!user) redirect("/login");
  if (!hasModuleAccess(user, "read", "M29")) {
    return <EmptyState title="No access" hint="Your roles do not include read on Purchase Orders (M29)." />;
  }

  const properties = await prisma.property.findMany({ where: { status: "active" }, orderBy: { code: "asc" }, select: { id: true, code: true, name: true } });
  const visible = properties.filter((p) => can(user, "read", "M29", { propertyId: p.id }));
  const firstAssigned = user.propertyIds.length > 0 ? properties.find((p) => p.id === user.propertyIds[0]) ?? visible[0] : visible[0];

  const defaultPropertyId = firstAssigned?.id ?? visible[0]?.id ?? null;

  return (
    <div className="space-y-4">
      <PageHeader
        title="Purchase Orders"
        description="Plan stock purchases per supplier and receive them as M15 stock movements — on hand and moving-average cost only change on receipt."
      />
      <PoManager
        canWrite={hasModuleAccess(user, "update", "M29") || hasModuleAccess(user, "create", "M29")}
        visibleProperties={visible.map((p) => ({ id: p.id, code: p.code, name: p.name }))}
        defaultPropertyId={defaultPropertyId}
      />
    </div>
  );
}