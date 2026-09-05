"use client";

import { createContext, useContext } from "react";
import { DEFAULT_LOCALE, tfIn, tIn, tNavIn, type Locale } from "@/lib/i18n";

/// Locale flows down as React context from the root layout's resolved value —
/// SSR and hydration always agree, and there is no module state to race.
const LocaleContext = createContext<Locale>(DEFAULT_LOCALE);

export function I18nProvider({ locale, children }: { locale: Locale; children: React.ReactNode }) {
  return <LocaleContext.Provider value={locale}>{children}</LocaleContext.Provider>;
}

export function useLocale(): Locale {
  return useContext(LocaleContext);
}

/// Bound translators for client components: const { t, tf, tNav } = useT();
export function useT() {
  const locale = useContext(LocaleContext);
  return {
    locale,
    t: (key: string) => tIn(locale, key),
    tf: (key: string, vars: Record<string, string | number>) => tfIn(locale, key, vars),
    tNav: (label: string) => tNavIn(locale, label)
  };
}
