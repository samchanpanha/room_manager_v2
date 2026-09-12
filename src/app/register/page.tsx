import { RegisterForm } from "@/app/register/register-form";
import { LanguageSwitcher } from "@/components/language-switcher";
import { getT } from "@/lib/locale-server";
import { Tx } from "@/components/i18n-text";
import Link from "next/link";

export default async function RegisterPage() {
  const { t } = await getT();

  return (
    <div className="relative flex min-h-screen items-center justify-center bg-muted/30 p-4 py-8">
      <div className="absolute right-4 top-4 z-10">
        <LanguageSwitcher compact />
      </div>
      <div className="w-full max-w-lg">
        <div className="mb-6 text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-primary text-xl font-bold text-primary-foreground shadow-sm">
            <span>R</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight">{t("app.name")}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            <Tx>Create a new multi-tenant organization workspace</Tx>
          </p>
        </div>

        <RegisterForm />

        <div className="mt-6 text-center text-sm text-muted-foreground">
          <Tx>Already have a workspace?</Tx>{" "}
          <Link href="/login" className="font-semibold text-primary hover:underline">
            <Tx>Sign in to your account</Tx>
          </Link>
        </div>
      </div>
    </div>
  );
}
