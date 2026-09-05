import type { Metadata } from "next";
import "./globals.css";
import { Providers } from "@/components/providers";
import { I18nProvider } from "@/components/i18n-provider";
import { getT } from "@/lib/locale-server";

export const metadata: Metadata = {
  title: "RentManager",
  description: "Rental & co-living operations platform"
};

const themeInit = `
try {
  var t = localStorage.getItem("rm-theme");
  if (t === "dark" || (!t && window.matchMedia("(prefers-color-scheme: dark)").matches)) {
    document.documentElement.classList.add("dark");
  }
} catch (e) {}
`;

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  // Resolve the request locale once (rm-locale cookie → §M28 org default → en)
  // and flow it down as props/context — SSR and hydration stay in sync.
  const { locale } = await getT();

  return (
    <html lang={locale} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInit }} />
      </head>
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
