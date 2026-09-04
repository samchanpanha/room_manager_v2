"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { NAV } from "@/lib/nav";
import { cn } from "@/lib/utils";
import { t } from "@/lib/i18n";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/theme-toggle";

export interface ShellUser {
  name: string;
  email: string;
  roles: string[];
}

export function Shell({
  user,
  moduleAllowed,
  children
}: {
  user: ShellUser;
  moduleAllowed: Record<string, boolean>;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.replace("/login");
    router.refresh();
  }

  const roleBadges = user.roles.map((r) => r.replaceAll("_", " ").toLowerCase());

  return (
    <div className="flex min-h-screen">
      {/* Sidebar */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-40 w-64 shrink-0 overflow-y-auto border-r bg-card transition-transform lg:static lg:translate-x-0",
          open ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <div className="flex h-14 items-center gap-2 border-b px-4">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary text-sm font-bold text-primary-foreground">
            R
          </div>
          <span className="font-semibold">{t("app.name")}</span>
        </div>
        <nav className="p-3 pb-16">
          {NAV.map((group) => {
            const items = group.items.filter((item) => !item.module || moduleAllowed[item.module]);
            if (items.length === 0) return null;
            return (
              <div key={group.label} className="mb-4">
                <p className="mb-1.5 px-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  {t(group.label)}
                </p>
                <ul className="space-y-0.5">
                  {items.map((item) => {
                    if (item.href) {
                      const active = pathname === item.href || pathname.startsWith(item.href + "/");
                      return (
                        <li key={item.label}>
                          <Link
                            href={item.href}
                            onClick={() => setOpen(false)}
                            className={cn(
                              "flex items-center justify-between rounded-md px-2 py-1.5 text-sm transition-colors",
                              active
                                ? "bg-secondary font-medium text-secondary-foreground"
                                : "text-muted-foreground hover:bg-accent hover:text-foreground"
                            )}
                          >
                            {item.label}
                          </Link>
                        </li>
                      );
                    }
                    return (
                      <li key={item.label}>
                        <span
                          title={`Scheduled for Phase ${item.phase}`}
                          className="flex cursor-not-allowed items-center justify-between rounded-md px-2 py-1.5 text-sm text-muted-foreground/50"
                        >
                          {item.label}
                          <Badge variant="outline" className="px-1.5 text-[10px]">
                            P{item.phase}
                          </Badge>
                        </span>
                      </li>
                    );
                  })}
                </ul>
              </div>
            );
          })}
        </nav>
      </aside>

      {/* Main */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b bg-background/95 px-4 backdrop-blur">
          <Button variant="ghost" size="icon" className="lg:hidden" onClick={() => setOpen((v) => !v)} aria-label="Toggle navigation">
            ☰
          </Button>
          <div className="flex-1" />
          <ThemeToggle />
          <div className="flex items-center gap-3 border-l pl-3">
            <div className="text-right">
              <p className="text-sm font-medium leading-tight">{user.name}</p>
              <p className="text-xs capitalize leading-tight text-muted-foreground">{roleBadges.join(" · ")}</p>
            </div>
            <Button variant="outline" size="sm" onClick={logout}>
              Sign out
            </Button>
          </div>
        </header>
        <main className="flex-1 p-4 sm:p-6">{children}</main>
      </div>

      {/* Overlay for mobile sidebar */}
      {open ? <div className="fixed inset-0 z-30 bg-black/40 lg:hidden" onClick={() => setOpen(false)} aria-hidden /> : null}
    </div>
  );
}
