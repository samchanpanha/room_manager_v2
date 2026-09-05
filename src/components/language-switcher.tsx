"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { LOCALES, LOCALE_META, applyLocale, type Locale } from "@/lib/i18n";
import { useT } from "@/components/i18n-provider";
import { cn } from "@/lib/utils";

/// Language picker for the switchable UI languages (en / km / zh).
/// Selecting one persists the `rm-locale` cookie and refreshes the server
/// tree; the root layout re-resolves and the new locale flows through the
/// tree via context. `compact` renders the standalone variant used on /login.
export function LanguageSwitcher({ compact = false }: { compact?: boolean }) {
  const router = useRouter();
  const { locale, t } = useT();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const close = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("click", close);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("click", close);
      window.removeEventListener("keydown", onKey);
    };
  }, []);

  function choose(next: Locale) {
    applyLocale(next);
    setOpen(false);
    router.refresh();
  }

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={t("lang.label")}
        aria-haspopup="listbox"
        aria-expanded={open}
        title={t("lang.label")}
        className={cn(
          "flex h-9 items-center gap-1.5 rounded-md px-2 text-sm transition-colors hover:bg-accent hover:text-foreground",
          compact && "border bg-card shadow-sm"
        )}
      >
        <span aria-hidden>🌐</span>
        <span className="max-w-16 truncate text-xs font-medium">{LOCALE_META[locale].native}</span>
        <span aria-hidden className="text-[10px] text-muted-foreground">
          {open ? "▾" : "▸"}
        </span>
      </button>
      {open ? (
        <div role="listbox" aria-label={t("lang.label")} className="absolute right-0 top-10 z-50 w-48 overflow-hidden rounded-lg border bg-popover p-1 shadow-lg">
          {LOCALES.map((option) => (
            <button
              key={option}
              type="button"
              role="option"
              aria-selected={option === locale}
              onClick={() => choose(option)}
              className={cn(
                "flex w-full items-center justify-between gap-2 rounded-md px-2.5 py-1.5 text-left text-sm hover:bg-accent",
                option === locale && "bg-accent font-medium text-accent-foreground"
              )}
            >
              <span>{LOCALE_META[option].native}</span>
              <span className="text-[11px] text-muted-foreground">{LOCALE_META[option].name}</span>
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
