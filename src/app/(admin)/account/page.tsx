import { redirect } from "next/navigation";
import { getAuthUser } from "@/lib/auth/session";
import { PageHeader } from "@/components/ui/misc";
import { AccountForm } from "./account-form";

export const dynamic = "force-dynamic";

export default async function AccountPage() {
  const user = await getAuthUser();
  if (!user) redirect("/login");

  return (
    <div>
      <PageHeader title="My account" description="Your profile and sign-in settings" />
      <AccountForm initialName={user.name} email={user.email} roles={user.roles} />
    </div>
  );
}