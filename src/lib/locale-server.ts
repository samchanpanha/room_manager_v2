/// Server-side locale resolution for the i18n chain (§lib/i18n):
/// `rm-locale` cookie (LanguageSwitcher choice) → §M28 org default
/// (Settings → Locale → Language) → English. Cached per request via React
/// `cache`, so the root layout and every server component share one
/// resolution. The settings store is imported lazily and failure-tolerant so
/// pages that work without the DB (e.g. /login) never break on resolution.
import { cookies } from "next/headers";
import { cache } from "react";
import { DEFAULT_LOCALE, LOCALE_COOKIE, tfIn, tIn, tNavIn, toLocale, type Locale } from "@/lib/i18n";

export const getResolvedLocale = cache(async (): Promise<Locale> => {
  try {
    const store = await cookies();
    const fromCookie = toLocale(store.get(LOCALE_COOKIE)?.value);
    if (fromCookie) return fromCookie;
  } catch {
    /* no request scope (tests, cron jobs) */
  }
  try {
    const { getSettings } = await import("@/lib/settings");
    const settings = await getSettings();
    const fromOrg = toLocale(settings.locale.locale);
    if (fromOrg) return fromOrg;
  } catch {
    /* DB unavailable — fall through to the default */
  }
  return DEFAULT_LOCALE;
});

/// Request-bound translators for server components: const { t } = await getT();
export const getT = cache(async () => {
  const locale = await getResolvedLocale();
  return {
    locale,
    t: (key: string) => tIn(locale, key),
    tf: (key: string, vars: Record<string, string | number>) => tfIn(locale, key, vars),
    tNav: (label: string) => tNavIn(locale, label)
  };
});
