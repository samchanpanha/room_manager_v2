import { Loginform } from "./login-form";
import { LanguageSwitcher } from "@/components/language-switcher";
import { getT } from "@/lib/locale-server";

export default async function LoginPage() {
  const { t } = await getT();
  return (
    <div className="relative flex min-h-screen items-center justify-center bg-muted/30 p-4">
      <div className="absolute right-4 top-4 z-10">
        <LanguageSwitcher compact />
      </div>
      <div className="w-full max-w-sm">
        <div className="mb-6 text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-primary text-xl font-bold text-primary-foreground">
            R
          </div>
          <h1 className="text-xl font-semibold">{t("app.name")}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{t("auth.login.tagline")}</p>
        </div>
        <Loginform />
        <div className="mt-4 rounded-lg border bg-card p-3 text-xs text-muted-foreground">
          <p className="font-medium text-foreground">{t("auth.login.demoTitle")}</p>
          <p className="mt-1">root@demo.test · admin@demo.test · pm@demo.test</p>
          <p>accountant@demo.test · staff@demo.test · owner@demo.test</p>
        </div>
      </div>
    </div>
  );
}
