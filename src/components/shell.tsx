"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { NAV } from "@/lib/nav";
import { cn } from "@/lib/utils";
import { tIn, tNavIn } from "@/lib/i18n";
import { useT } from "@/components/i18n-provider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ThemeToggle } from "@/components/theme-toggle";
import { LanguageSwitcher } from "@/components/language-switcher";
import { HelpCenter } from "@/components/help";
import { TabStrip } from "@/components/tab-strip";
import { Icon } from "@/components/icon";
import { navIcon, navGroupIcon } from "@/lib/icons";

export interface ShellUser {
  name: string;
  email: string;
  roles: string[];
}

export interface ShellBrand {
  name: string;
  legalName: string;
  logo: string;
}

export interface ShellMenu {
  side: "left" | "right";
}

export function Shell({
  user,
  moduleAllowed,
  org,
  menu,
  children
}: {
  user: ShellUser;
  moduleAllowed: Record<string, boolean>;
  org: ShellBrand;
  menu: ShellMenu;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const { locale, t, tf, tNav } = useT();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.replace("/login");
    router.refresh();
  }

  const roleBadges = user.roles.map((r) => r.replaceAll("_", " ").toLowerCase());
  const searching = query.trim().length > 0;

  const groups = useMemo(() => {
    const q = query.trim().toLowerCase();
    return NAV.map((group) => {
      const items = group.items.filter((item) => !item.module || moduleAllowed[item.module]);
      // Match on both the translated and the English label.
      const hit = items.filter(
        (item) =>
          !q ||
          item.label.toLowerCase().includes(q) ||
          tNavIn(locale, item.label).toLowerCase().includes(q) ||
          tIn(locale, group.label).toLowerCase().includes(q)
      );
      return { ...group, items: hit };
    }).filter((g) => g.items.length > 0);
  }, [query, moduleAllowed, locale]);

  const isCollapsed = (key: string) => collapsed[key] && !searching;

  const brandNode = org.logo ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={org.logo} alt={org.name} className="h-8 w-8 rounded-lg object-contain" />
  ) : (
    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-sm font-bold text-primary-foreground">
      {(org.name || t("app.name")).trim().charAt(0).toUpperCase()}
    </div>
  );

  const aside = (
    <aside
      data-tour="menu"
      className={cn(
        "fixed inset-y-0 z-40 w-64 shrink-0 overflow-y-auto border-r bg-card transition-transform lg:static lg:translate-x-0",
        menu.side === "left" && "left-0",
        menu.side === "right" && "left-auto right-0 border-r-0 border-l lg:order-last",
        menu.side === "left" ? (!open ? "-translate-x-full" : "translate-x-0") : !open ? "translate-x-full" : "translate-x-0"
      )}
    >
      <div data-tour="brand" className="flex h-14 items-center gap-2 border-b px-4">
        {brandNode}
        <div className="min-w-0">
          <span className="block truncate font-semibold">{org.name || t("app.name")}</span>
          <span className="block truncate text-[11px] text-muted-foreground">{org.legalName}</span>
        </div>
      </div>

      <div className="p-3">
        <Input
          data-tour="menu-search"
          type="search"
          placeholder={t("shell.search")}
          aria-label={t("shell.searchAria")}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>

      <nav className="px-3 pb-16">
        {groups.map((group) => {
          const key = group.label;
          const closed = isCollapsed(key);
          return (
            <div data-tour="menu-group" key={key} className="mb-1">
              <button
                type="button"
                onClick={() => setCollapsed((c) => ({ ...c, [key]: !c[key] }))}
                aria-expanded={!closed}
                className="flex w-full items-center justify-between rounded-md px-2 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground hover:bg-accent hover:text-foreground"
              >
                <span className="flex items-center gap-1.5">
                  <Icon name={navGroupIcon(group.label)} className="h-3.5 w-3.5" />
                  {t(group.label)}
                </span>
                <span aria-hidden className="text-[10px]">{closed ? "▸" : "▾"}</span>
              </button>
              {!closed && (
                <ul className="space-y-0.5">
                  {group.items.map((item) => {
                    if (item.href) {
                      const active = pathname === item.href || pathname.startsWith(item.href + "/");
                      return (
                        <li key={item.label}>
                          <Link
                            href={item.href}
                            onClick={() => setOpen(false)}
                            className={cn(
                              "flex items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors",
                              active
                                ? "bg-secondary font-medium text-secondary-foreground"
                                : "text-muted-foreground hover:bg-accent hover:text-foreground"
                            )}
                          >
                            <Icon name={navIcon(item.label)} className="h-4 w-4 shrink-0" />
                            <span className="min-w-0 flex-1 truncate">{tNav(item.label)}</span>
                          </Link>
                        </li>
                      );
                    }
                    return (
                      <li key={item.label}>
                        <span
                          title={tf("shell.phaseHint", { phase: item.phase ?? "" })}
                          className="flex cursor-not-allowed items-center gap-2 rounded-md px-2 py-1.5 text-sm text-muted-foreground/50"
                        >
                          <Icon name={navIcon(item.label)} className="h-4 w-4 shrink-0 opacity-50" />
                          <span className="min-w-0 flex-1 truncate">{tNav(item.label)}</span>
                          <Badge variant="outline" className="px-1.5 text-[10px]">
                            P{item.phase}
                          </Badge>
                        </span>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          );
        })}
        {groups.length === 0 && <p className="px-2 py-4 text-xs text-muted-foreground">{tf("shell.noResults", { q: query })}</p>}
      </nav>
    </aside>
  );

  return (
    <div className="flex min-h-screen">
      {menu.side === "left" ? aside : null}
      <div className="flex min-w-0 flex-1 flex-col">
        <header data-tour="header" className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b bg-background/95 px-4 backdrop-blur">
          <Button variant="ghost" size="icon" className="lg:hidden" onClick={() => setOpen((v) => !v)} aria-label={t("shell.toggleNav")}>
            ☰
          </Button>
          <div className="flex-1" />
          <LanguageSwitcher />
          <ThemeToggle />
          <HelpCenter />
          <div className="flex items-center gap-3 border-l pl-3">
            <div className="text-right">
              <p className="text-sm font-medium leading-tight">{user.name}</p>
              <p className="text-xs capitalize leading-tight text-muted-foreground">{roleBadges.join(" · ")}</p>
            </div>
            <Button variant="outline" size="sm" onClick={logout}>
              {t("shell.signOut")}
            </Button>
          </div>
        </header>
        <TabStrip />
        <main className="flex-1 p-4 sm:p-6">{children}</main>
      </div>
      {menu.side === "right" ? aside : null}

      {open ? <div className="fixed inset-0 z-30 bg-black/40 lg:hidden" onClick={() => setOpen(false)} aria-hidden /> : null}
    </div>
  );
}