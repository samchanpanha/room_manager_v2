import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { getAuthUser } from "@/lib/auth/session";
import { can } from "@/lib/rbac/can";
import { PageHeader } from "@/components/ui/misc";
import { OnboardingWizard } from "./onboarding-wizard";
import { Tx } from "@/components/i18n-text";

export const dynamic = "force-dynamic";

export default async function NewMemberPage() {
  const user = await getAuthUser();
  if (!user) redirect("/login");
  if (!can(user, "create", "M02")) {
    return (
      <div>
        <PageHeader title="Onboard member" />
        <p className="text-sm text-destructive"><Tx>Your roles do not include create on Members (M02).</Tx></p>
      </div>
    );
  }

  const [properties, docTypes] = await Promise.all([
    prisma.property.findMany({ orderBy: { code: "asc" } }),
    prisma.docType.findMany({ orderBy: { sortOrder: "asc" } })
  ]);

  // Which properties can this user upload documents into? (M17:create, property-scoped)
  const uploadablePropertyIds = properties
    .filter((p) => can(user, "create", "M17", { propertyId: p.id }))
    .map((p) => p.id);

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        title="Onboard member"
        description="M02 onboarding wizard — personal details, emergency contact, KYC documents"
      />
      <OnboardingWizard
        properties={properties.map((p) => ({ id: p.id, label: `${p.code} · ${p.name}` }))}
        docTypes={docTypes.map((d) => ({
          id: d.id,
          name: d.name,
          kycRequired: d.kycRequired,
          requiresExpiry: d.requiresExpiry
        }))}
        uploadablePropertyIds={uploadablePropertyIds}
      />
    </div>
  );
}
