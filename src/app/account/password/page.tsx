import { redirect } from "next/navigation";
import { getAuthUser } from "@/lib/auth/session";
import { Tx } from "@/components/i18n-text";
import { PasswordChangeForm } from "./PasswordChangeForm";

export const dynamic = "force-dynamic";

export default async function ChangePasswordPage({ searchParams }: { searchParams: Promise<{ force?: string }> }) {
  const user = await getAuthUser();
  if (!user) redirect("/login");

  const sp = await searchParams;
  const force = sp.force === "1" || user.mustChangePassword;

  return (
    <main className="flex min-h-screen items-center justify-center bg-background p-4">
      <div className="w-full max-w-md">
        <div className="mb-6 text-center">
          <h1 className="text-lg font-semibold">
            <Tx>{force ? "Change your password to continue" : "Change password"}</Tx>
          </h1>
        </div>
        <PasswordChangeForm force={force} />
      </div>
    </main>
  );
}