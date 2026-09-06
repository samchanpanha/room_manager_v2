import type { Metadata } from "next";
import { cookies } from "next/headers";
import "./globals.css";
import { Providers } from "@/components/providers";
import { I18nProvider } from "@/components/i18n-provider";
import { getT } from "@/lib/locale-server";

export const metadata: Metadata = {
  title: "RentManager",
  description: "Rental & co-living operations platform"
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  // Resolve the request locale once (rm-locale cookie → §M28 org default → en)
  // and flow it down as props/context — SSR and hydration stay in sync.
  const { locale } = await getT();

  // Theme (rm-theme cookie) is resolved HERE on the server and rendered onto
  // <html>, so the first paint is exactly what was chosen — no inline script,
  // no hydration mismatch, no flash on reload. Toggling writes the same cookie.
  const theme = (await cookies()).get("rm-theme")?.value;
  const dark = theme === "dark";

  return (
    <html lang={locale} className={dark ? "dark" : undefined}>
      <body className="min-h-screen font-sans antialiased">
        {/* I18nProvider wraps Providers: the ToastProvider (and every other
            client primitive) resolves the active locale through useT(). */}
        <I18nProvider locale={locale}>
          <Providers>{children}</Providers>
        </I18nProvider>
      </body>
    </html>
  );
}
