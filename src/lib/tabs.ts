/// Tab-strip helpers: turn the current route into a Chrome-style tab
/// (label + module accent). Pure functions — no React/router here.

import { NAV } from "@/lib/nav";
import { titleCase } from "@/lib/utils";

export const HOME_TAB_HREF = "/dashboard";

export interface OpenTabMeta {
  href: string;
  label: string;
  module?: string;
}

/// Resolve a real pathname (already resolved, no "[id]" tokens) to a tab meta.
/// Exact nav entries win; a dynamic child of a nav page gets
/// "<Page> · <segment>" so each record opens as its own tab.
export function tabMetaFor(pathname: string): OpenTabMeta {
  for (const group of NAV) {
    for (const item of group.items) {
      if (!item.href) continue;
      if (pathname === item.href || pathname.startsWith(item.href + "/")) {
        const extra = pathname.slice(item.href.length).split("/").filter(Boolean).at(-1);
        return extra ? { href: pathname, label: `${item.label} · ${titleCase(extra.replaceAll("_", " "))}`, module: item.module } : { href: pathname, label: item.label, module: item.module };
      }
    }
  }
  if (pathname === "/dashboard") return { href: pathname, label: "Dashboard" };
  const seg = pathname.split("/").filter(Boolean).at(-1) ?? "Page";
  return { href: pathname, label: titleCase(seg.replaceAll("_", " ").replaceAll("-", " ")) };
}

const ACCENTS: Record<string, string> = {
  M01: "bg-slate-500",
  M02: "bg-sky-500",
  M03: "bg-amber-500",
  M04: "bg-emerald-500",
  M06: "bg-indigo-500",
  M07: "bg-violet-500",
  M08: "bg-rose-500",
  M09: "bg-teal-500",
  M10: "bg-orange-500",
  M11: "bg-cyan-500",
  M14: "bg-fuchsia-500",
  M15: "bg-lime-600",
  M16: "bg-red-500",
  M18: "bg-yellow-500",
  M19: "bg-pink-500",
  M20: "bg-slate-500",
  M21: "bg-blue-500",
  M22: "bg-purple-500",
  M23: "bg-green-600",
  M24: "bg-stone-500",
  M25: "bg-amber-600",
  M26: "bg-emerald-600",
  M27: "bg-zinc-600",
  M28: "bg-zinc-500",
  M29: "bg-lime-500",
  OWNER_PORTAL: "bg-orange-600"
};

export function moduleAccent(module?: string): string {
  return (module && ACCENTS[module]) || "bg-muted-foreground";
}