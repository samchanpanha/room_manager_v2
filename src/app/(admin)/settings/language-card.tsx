"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/toast";
import { useT } from "@/components/i18n-provider";
import { LOCALES, LOCALE_META, applyLocale, isLocale, tfIn, type Locale } from "@/lib/i18n";
import { cn } from "@/lib/utils";

/// §M28 Settings → Language.
/// Two layers, both optional:
///   1. the ORG DEFAULT (`m28.locale.locale`) — what a brand-new browser gets;
///   2. the PER-BROWSER choice (`rm-locale` cookie) — what this device shows,
///      set by the header switcher or by "Apply to my browser" below.
/// Resolution is cookie → org default → English (src/lib/locale-server.ts).
export function LanguageCard({ orgDefault, canWrite }: { orgDefault: string; canWrite: boolean }) {
  const router = useRouter();
  const { push } = useToast();
  const { locale, tUi } = useT();
  const [selected, setSelected] = useState<Locale>(isLocale(orgDefault) ? orgDefault : "en");
  const [busy, setBusy] = useState(false);

  const current = isLocale(orgDefault) ? orgDefault : "en";
  const overridden = locale !== current;

  async function saveOrgDefault() {
    setBusy(true);
    const res = await fetch("/api/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ group: "locale", patch: { locale: selected } })
    });
    const data = (await res.json().catch(() => ({}))) as { message?: string };
    setBusy(false);
    push(
      res.ok
        ? { title: tUi("Default language saved"), variant: "success" }
        : { title: tUi("Save failed"), description: data.message, variant: "destructive" }
    );
    if (res.ok) router.refresh();
  }

  function applyToBrowser(next: Locale) {
    applyLocale(next);
    router.refresh();
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Language</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-xs text-muted-foreground">{tUi("settings.language.intro")}</p>

        <div role="radiogroup" aria-label={tUi("Language")} className="grid gap-2 sm:grid-cols-3">
          {LOCALES.map((option) => {
            const meta = LOCALE_META[option];
            const active = option === selected;
            return (
              <button
                key={option}
                type="button"
                role="radio"
                aria-checked={active}
                disabled={!canWrite}
                onClick={() => setSelected(option)}
                className={cn(
                  "flex flex-col items-start gap-0.5 rounded-lg border p-3 text-left transition-colors",
                  active ? "border-primary bg-primary/5" : "hover:bg-accent",
                  !canWrite && "cursor-not-allowed opacity-60"
                )}
              >
                <span className="text-sm font-medium">{meta.native}</span>
                <span className="text-xs text-muted-foreground">{meta.name}</span>
                {option === current ? <span className="mt-1 text-[11px] text-primary">{tUi("Org default")}</span> : null}
                {option === locale ? <span className="text-[11px] text-muted-foreground">{tUi("This browser")}</span> : null}
              </button>
            );
          })}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {canWrite ? (
            <Button size="sm" disabled={busy || selected === current} onClick={() => void saveOrgDefault()}>
              Save as org default
            </Button>
          ) : null}
          <Button size="sm" variant="outline" disabled={selected === locale} onClick={() => applyToBrowser(selected)}>
            Apply to my browser
          </Button>
          {locale !== "en" ? (
            <Button size="sm" variant="ghost" onClick={() => applyToBrowser("en")}>
              Reset my browser to English
            </Button>
          ) : null}
        </div>

        <p className="text-xs text-muted-foreground">
          Showing: <span className="font-medium">{LOCALE_META[locale].native}</span>
          {overridden ? ` · ${tfIn(locale, "settings.langOverridden", { lang: LOCALE_META[current].name })}` : ` · ${tUi("org default")}`}
        </p>
      </CardContent>
    </Card>
  );
}
