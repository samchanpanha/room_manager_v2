import type { Metadata, Viewport } from "next";
import Link from "next/link";
import { getAuthUser } from "@/lib/auth/session";

/// §M25 Tenant Portal shell — mobile-first (max-w-md, bottom tab nav). The
/// chrome renders only for signed-in members; /portal/login stays bare.
export const metadata: Metadata = { title: "Resident Portal · RentManager" };
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#0b0b0c"
};

const TABS = [
  { href: "/portal", label: "Home" },
  { href: "/portal/invoices", label: "Rent" },
  { href: "/portal/requests", label: "Requests" },
  { href: "/portal/docs", label: "Docs" },
  { href: "/portal/me", label: "Me" }
];

export default async function PortalLayout({ children }: { children: React.ReactNode }) {
  const user = await getAuthUser();
  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col">
      {user ? (
        <header className="flex items-center justify-between border-b px-4 py-3">
          <Link href="/portal" className="text-sm font-semibold tracking-tight">
            Resident
          </Link>
          <span className="text-xs text-muted-foreground">{user.name}</span>
        </header>
      ) : null}
      <main className={`flex-1 px-4 pb-24 pt-4 ${user ? "" : "flex items-center justify-center"}`}>{children}</main>
      {user ? (
        <nav className="fixed inset-x-0 bottom-0 z-10 border-t bg-background/95 backdrop-blur">
          <div className="mx-auto grid max-w-md grid-cols-5">
            {TABS.map((t) => (
              <Link key={t.href} href={t.href} className="py-2.5 text-center text-xs text-muted-foreground hover:text-foreground">
                {t.label}
              </Link>
            ))}
          </div>
        </nav>
      ) : null}
    </div>
  );
}
