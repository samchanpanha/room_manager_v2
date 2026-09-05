"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { usePathname, useRouter } from "next/navigation";
import { HOME_TAB_HREF, tabMetaFor, moduleAccent } from "@/lib/tabs";
import { moduleIcon } from "@/lib/icons";
import { Icon } from "@/components/icon";
import { useT } from "@/components/i18n-provider";
import { tNavIn, type Locale } from "@/lib/i18n";
import { cn } from "@/lib/utils";

interface OpenTab {
  href: string;
  label: string;
  module?: string;
}

interface TabMenu {
  x: number;
  y: number;
  tab: OpenTab;
}

const MAX_TABS = 12;

/// Tabs store the English label (from lib/tabs); render-time translation.
/// Dynamic children use "<Page> · <Segment>" — translate only the page part.
function tabLabel(locale: Locale, label: string): string {
  const idx = label.indexOf(" · ");
  return idx === -1 ? tNavIn(locale, label) : `${tNavIn(locale, label.slice(0, idx))} · ${label.slice(idx + 3)}`;
}

function invalidate(next: OpenTab[], activeRemoved: boolean, router: ReturnType<typeof useRouter>, prev: OpenTab[]) {
  if (!activeRemoved || next.length === 0) return;
  const activeIdx = prev.findIndex((t) => t.href === window.location.pathname);
  const fallback = next[Math.min(Math.max(activeIdx - 1, 0), next.length - 1)] ?? next[0];
  router.push(fallback.href);
}

/// Chrome-style tab strip. Every navigation opens/activates a tab; right-click
/// (or the ⋯ menu) offers Close / others / to the left / to the right / all.
/// The Dashboard tab is pinned and unclosable; middle-click closes a tab.
export function TabStrip() {
  const pathname = usePathname();
  const router = useRouter();
  const { locale, t, tf } = useT();
  const [tabs, setTabs] = useState<OpenTab[]>(() => [{ href: HOME_TAB_HREF, label: "Dashboard", module: "HOME" }]);
  const [menu, setMenu] = useState<TabMenu | null>(null);

  const isActive = (href: string) => pathname === href || pathname.startsWith(href + "/");

  useEffect(() => {
    setTabs((prev) => {
      if (prev.some((t) => t.href === pathname)) return prev;
      const meta = tabMetaFor(pathname);
      const next = [...prev, meta];
      return next.length > MAX_TABS ? next.slice(next.length - MAX_TABS) : next;
    });
  }, [pathname]);

  useEffect(() => {
    if (!menu) return;
    const close = () => setMenu(null);
    window.addEventListener("click", close);
    window.addEventListener("resize", close);
    return () => {
      window.removeEventListener("click", close);
      window.removeEventListener("resize", close);
    };
  }, [menu]);

  function closeSet(hrefs: Set<string>) {
    const prev = tabs;
    const activeRemoved = prev.some((t) => hrefs.has(t.href) && isActive(t.href));
    const next = prev.filter((t) => t.href === HOME_TAB_HREF || !hrefs.has(t.href));
    setTabs(next);
    setMenu(null);
    invalidate(next, activeRemoved, router, prev);
  }

  function closeTab(tab: OpenTab) {
    closeSet(new Set([tab.href]));
  }

  function menuFor(tab: OpenTab): Array<{ label: string; disabled: boolean; run: () => void }> {
    const idx = tabs.findIndex((t) => t.href === tab.href);
    const pinned = tab.href === HOME_TAB_HREF;
    const left = idx > 0 && tabs.slice(0, idx).some((t) => t.href !== HOME_TAB_HREF);
    const right = idx >= 0 && idx < tabs.length - 1;
    const others = tabs.some((t) => t.href !== HOME_TAB_HREF && t.href !== tab.href);
    return [
      { label: t("tabs.close"), disabled: pinned, run: () => closeTab(tab) },
      { label: t("tabs.closeOthers"), disabled: !others, run: () => closeSet(new Set(tabs.filter((t) => t.href !== tab.href && t.href !== HOME_TAB_HREF).map((t) => t.href))) },
      { label: t("tabs.closeLeft"), disabled: !left, run: () => closeSet(new Set(tabs.slice(0, idx).filter((t) => t.href !== HOME_TAB_HREF).map((t) => t.href))) },
      { label: t("tabs.closeRight"), disabled: !right, run: () => closeSet(new Set(tabs.slice(idx + 1).map((t) => t.href))) },
      { label: t("tabs.closeAll"), disabled: tabs.length <= 1, run: () => closeSet(new Set(tabs.filter((t) => t.href !== HOME_TAB_HREF).map((t) => t.href))) }
    ];
  }

  function renderMenu(m: TabMenu) {
    const style: React.CSSProperties = {
      left: Math.max(8, Math.min(m.x, (typeof window !== "undefined" ? window.innerWidth : 1200) - 200)),
      top: Math.max(8, Math.min(m.y, (typeof window !== "undefined" ? window.innerHeight : 800) - 240))
    };
    return createPortal(
      <div className="fixed inset-0 z-[120]" onClick={() => setMenu(null)} onContextMenu={(e) => { e.preventDefault(); setMenu(null); }}>
        <div className="absolute w-52 rounded-lg border bg-popover p-1 shadow-lg" style={style} onClick={(e) => e.stopPropagation()}>
          {menuFor(m.tab).map((item) => (
            <button
              key={item.label}
              type="button"
              disabled={item.disabled}
              onClick={item.run}
              className="block w-full rounded-md px-2.5 py-1.5 text-left text-sm text-popover-foreground hover:bg-accent disabled:opacity-40 disabled:hover:bg-transparent"
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>,
      document.body
    );
  }

  return (
    <div data-tour="tabs" className="flex items-end gap-1 overflow-x-auto border-b border-border bg-muted/60 px-2 pt-1.5" onContextMenu={(e) => { e.preventDefault(); setMenu(null); }}>
      {tabs.map((tab) => {
        const active = isActive(tab.href);
        const pinned = tab.href === HOME_TAB_HREF;
        return (
          <div
            key={tab.href}
            onClick={() => router.push(tab.href)}
            onContextMenu={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setMenu({ x: e.clientX, y: e.clientY, tab });
            }}
            onAuxClick={(e) => {
              if (e.button === 1) closeTab(tab);
            }}
            className={cn(
              "group relative flex h-8 min-w-[108px] max-w-[200px] cursor-pointer select-none items-center gap-1.5 rounded-t-lg border border-b-0 px-2.5 pl-2.5 text-xs transition-colors",
              active
                ? "border-border bg-background text-foreground shadow-[0_-1px_2px_rgba(0,0,0,0.04)]"
                : "border-transparent bg-muted/40 text-muted-foreground hover:bg-muted hover:text-foreground"
            )}
            title={tf("tabs.middleHint", { label: tabLabel(locale, tab.label) })}
          >
            <Icon name={moduleIcon(tab.module)} className={cn("h-3.5 w-3.5 shrink-0", active ? "text-primary" : "text-muted-foreground/70")} />
            <span className="truncate">{tabLabel(locale, tab.label)}</span>
            {!pinned && (
              <button
                type="button"
                aria-label={tf("tabs.closeNamed", { label: tabLabel(locale, tab.label) })}
                onClick={(e) => {
                  e.stopPropagation();
                  closeTab(tab);
                }}
                className="ml-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded text-muted-foreground/60 opacity-0 transition-opacity hover:bg-accent hover:text-foreground group-hover:opacity-100"
              >
                ×
              </button>
            )}
            <span className={cn("pointer-events-none absolute inset-x-1 bottom-0 h-[2px] rounded-t", active ? moduleAccent(tab.module) : "bg-transparent")} aria-hidden />
          </div>
        );
      })}

      <button
        type="button"
        title={t("tabs.newDashboard")}
        aria-label={t("tabs.newDashboard")}
        onClick={() => router.push(HOME_TAB_HREF)}
        className="mb-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-lg leading-none text-muted-foreground hover:bg-muted hover:text-foreground"
      >
        ＋
      </button>

      <button
        type="button"
        title={t("tabs.options")}
        aria-label={t("tabs.options")}
        onClick={(e) => {
          const activeTab = tabs.find((t) => isActive(t.href)) ?? tabs[tabs.length - 1];
          const rect = e.currentTarget.getBoundingClientRect();
          setMenu({ x: rect.left, y: rect.bottom + 4, tab: activeTab });
        }}
        className="mb-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
      >
        <Icon name="dots" className="h-4 w-4" />
      </button>

      <div className="mb-0.5 ml-auto hidden shrink-0 items-center gap-2 pr-1 text-[11px] text-muted-foreground sm:flex">
        <span className="h-2 w-2 rounded-full bg-success" aria-hidden /> {tf("tabs.hint", { n: tabs.length, max: MAX_TABS })}
      </div>

      {menu ? renderMenu(menu) : null}
    </div>
  );
}