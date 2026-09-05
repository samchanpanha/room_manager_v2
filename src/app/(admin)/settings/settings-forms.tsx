"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { useToast } from "@/components/toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { getSettings } from "@/lib/settings";

type Settings = Awaited<ReturnType<typeof getSettings>>;

async function send(url: string, method: string, body: unknown): Promise<{ ok: boolean; message?: string }> {
  const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const data = (await res.json().catch(() => ({}))) as { message?: string };
  return { ok: res.ok, message: data.message };
}

function useSave() {
  const router = useRouter();
  const { push } = useToast();
  const [busy, setBusy] = useState(false);
  async function save(group: string, patch: object, title: string) {
    setBusy(true);
    const r = await send("/api/settings", "PATCH", { group, patch });
    setBusy(false);
    push(r.ok ? { title, variant: "success" } : { title: "Failed", description: r.message, variant: "destructive" });
    if (r.ok) router.refresh();
  }
  return { busy, save };
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <Label>{label}</Label>
      {children}
    </div>
  );
}

export function SettingsForms({ settings, canWrite }: { settings: Settings; canWrite: boolean }) {
  const { busy, save } = useSave();
  const [org, setOrg] = useState(settings.org);
  const [locale, setLocale] = useState(settings.locale);
  const [billing, setBilling] = useState({ ...settings.billing, dunningDays: settings.billing.dunningDays.join(",") });
  const [lateFee, setLateFee] = useState(settings.lateFee);
  const [printer, setPrinter] = useState(settings.printer);
  const [telegram, setTelegram] = useState(settings.telegram);
  const [menu, setMenu] = useState(settings.menu);
  const [units, setUnits] = useState(settings.units.units);
  const [newUnit, setNewUnit] = useState("");
  const [templates, setTemplates] = useState({
    "invoice.issued": settings.templates["invoice.issued"] ?? "",
    "payment.confirmed": settings.templates["payment.confirmed"] ?? "",
    "invoice.dunning_reminder": settings.templates["invoice.dunning_reminder"] ?? ""
  });

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <Card>
        <CardHeader><CardTitle>Org profile</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <Field label="Name"><Input value={org.name} disabled={!canWrite} onChange={(e) => setOrg({ ...org, name: e.target.value })} /></Field>
          <Field label="Legal name"><Input value={org.legalName} disabled={!canWrite} onChange={(e) => setOrg({ ...org, legalName: e.target.value })} /></Field>
          <Field label="Address"><Input value={org.address} disabled={!canWrite} onChange={(e) => setOrg({ ...org, address: e.target.value })} /></Field>
          <div className="grid grid-cols-2 gap-2">
            <Field label="Phone"><Input value={org.phone} disabled={!canWrite} onChange={(e) => setOrg({ ...org, phone: e.target.value })} /></Field>
            <Field label="Email"><Input value={org.email} disabled={!canWrite} onChange={(e) => setOrg({ ...org, email: e.target.value })} /></Field>
            <Field label="Website"><Input value={org.website} disabled={!canWrite} onChange={(e) => setOrg({ ...org, website: e.target.value })} /></Field>
            <Field label="Tax ID"><Input value={org.taxId} disabled={!canWrite} onChange={(e) => setOrg({ ...org, taxId: e.target.value })} /></Field>
          </div>
          <Field label="Logo (image URL or data URL — shown on PDFs)">
            <Input value={org.logo} disabled={!canWrite} onChange={(e) => setOrg({ ...org, logo: e.target.value })} />
          </Field>
          <Field label="Invoice layout template">
            <select
              className="h-9 w-full rounded-md border bg-transparent px-2 text-sm"
              value={org.invoiceTemplate}
              disabled={!canWrite}
              onChange={(e) => setOrg({ ...org, invoiceTemplate: e.target.value })}
            >
              <option value="classic">Classic (A4, black &amp; white)</option>
              <option value="modern">Modern (branded header card)</option>
            </select>
          </Field>
          <Field label="Invoice / receipt footer note"><Input value={org.invoiceFooterNote} disabled={!canWrite} onChange={(e) => setOrg({ ...org, invoiceFooterNote: e.target.value })} /></Field>
          {canWrite && <Button size="sm" disabled={busy} onClick={() => void save("org", org, "Org profile saved")}>Save org</Button>}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Locale &amp; billing defaults</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-3 gap-2">
            <Field label="Currency"><Input value={locale.currency} disabled={!canWrite} onChange={(e) => setLocale({ ...locale, currency: e.target.value })} /></Field>
            <Field label="Timezone"><Input value={locale.timezone} disabled={!canWrite} onChange={(e) => setLocale({ ...locale, timezone: e.target.value })} /></Field>
            <Field label="Locale"><Input value={locale.locale} disabled={!canWrite} onChange={(e) => setLocale({ ...locale, locale: e.target.value })} /></Field>
          </div>
          <Button size="sm" variant="outline" disabled={!canWrite || busy} onClick={() => void save("locale", locale, "Locale saved")}>Save locale</Button>
          <Field label="Invoice prefix"><Input value={billing.invoicePrefix} disabled={!canWrite} onChange={(e) => setBilling({ ...billing, invoicePrefix: e.target.value })} /></Field>
          <Field label="Grace days (late fees)"><Input type="number" value={billing.graceDays} disabled={!canWrite} onChange={(e) => setBilling({ ...billing, graceDays: Number(e.target.value) })} /></Field>
          <Field label="Dunning reminder days (comma-separated)"><Input value={billing.dunningDays} disabled={!canWrite} onChange={(e) => setBilling({ ...billing, dunningDays: e.target.value })} /></Field>
          {canWrite && (
            <Button size="sm" disabled={busy} onClick={() => void save("billing", { ...billing, dunningDays: billing.dunningDays.split(",").map((d) => Number(d.trim())).filter((n) => Number.isFinite(n) && n >= 0) }, "Billing defaults saved")}>
              Save billing
            </Button>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Late-fee defaults</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <Field label="Mode (none | flat | percent)">
            <Input value={lateFee.mode} disabled={!canWrite} onChange={(e) => setLateFee({ ...lateFee, mode: e.target.value as Settings["lateFee"]["mode"] })} />
          </Field>
          <Field label="Flat amount (minor)"><Input type="number" value={lateFee.flatMinor} disabled={!canWrite} onChange={(e) => setLateFee({ ...lateFee, flatMinor: Number(e.target.value) })} /></Field>
          <Field label="Monthly percent (basis points)"><Input type="number" value={lateFee.monthlyPctBps} disabled={!canWrite} onChange={(e) => setLateFee({ ...lateFee, monthlyPctBps: Number(e.target.value) })} /></Field>
          <Field label="Cap (minor, 0 = none)"><Input type="number" value={lateFee.maxMinor} disabled={!canWrite} onChange={(e) => setLateFee({ ...lateFee, maxMinor: Number(e.target.value) })} /></Field>
          {canWrite && <Button size="sm" disabled={busy} onClick={() => void save("lateFee", lateFee, "Late-fee defaults saved")}>Save late fees</Button>}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Notification templates (Telegram)</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <p className="text-xs text-muted-foreground">
            Overrides for member notifications. Placeholders: invoice.issued → {"{code} {total}"} · payment.confirmed → {"{code} {receipt} {total}"} · dunning → {"{code} {due}"}. Empty = default text.
          </p>
          {(["invoice.issued", "payment.confirmed", "invoice.dunning_reminder"] as const).map((ev) => (
            <Field key={ev} label={ev}>
              <Input value={templates[ev]} disabled={!canWrite} placeholder="default" onChange={(e) => setTemplates({ ...templates, [ev]: e.target.value })} />
            </Field>
          ))}
          {canWrite && <Button size="sm" disabled={busy} onClick={() => void save("templates", templates, "Templates saved")}>Save templates</Button>}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Printers</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <p className="text-xs text-muted-foreground">Receipt and barcode-label printing. Paper width controls thermal slip sizing for printed PDFs / browser window.print().</p>
          <Field label="Receipt paper width">
            <select
              className="h-9 w-full rounded-md border bg-transparent px-2 text-sm"
              value={printer.paperWidthMm}
              disabled={!canWrite}
              onChange={(e) => setPrinter({ ...printer, paperWidthMm: Number(e.target.value) })}
            >
              <option value={58}>58 mm (2¼″)</option>
              <option value={80}>80 mm (3″)</option>
            </select>
          </Field>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={printer.autoPrintReceipt} disabled={!canWrite} onChange={(e) => setPrinter({ ...printer, autoPrintReceipt: e.target.checked })} />
            Auto-print the receipt right after each POS sale
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={printer.printBarcodeByDefault} disabled={!canWrite} onChange={(e) => setPrinter({ ...printer, printBarcodeByDefault: e.target.checked })} />
            Offer barcode label printing by default
          </label>
          <Field label="Receipt copies"><Input type="number" min={1} max={5} value={printer.receiptCopies} disabled={!canWrite} onChange={(e) => setPrinter({ ...printer, receiptCopies: Math.max(1, Math.min(5, Number(e.target.value) || 1)) })} /></Field>
          {canWrite && <Button size="sm" disabled={busy} onClick={() => void save("printer", printer, "Printer settings saved")}>Save printers</Button>}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Sidebar</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <p className="text-xs text-muted-foreground">Where the app menu sits in the shell. Applies on next reload.</p>
          <select
            className="h-9 w-full rounded-md border bg-transparent px-2 text-sm"
            value={menu.side}
            disabled={!canWrite}
            onChange={(e) => setMenu({ side: e.target.value as Settings["menu"]["side"] })}
          >
            <option value="left">Left</option>
            <option value="right">Right</option>
          </select>
          {canWrite && <Button size="sm" disabled={busy} onClick={() => void save("menu", menu, "Sidebar position saved")}>Save sidebar</Button>}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Stock units</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <p className="text-xs text-muted-foreground">Measurement units offered when creating stock items and POS products. Items keep their unit even if the list changes.</p>
          <div className="flex flex-wrap gap-1.5">
            {units.map((u) => (
              <span key={u} className="inline-flex items-center gap-1 rounded-full border bg-muted px-2.5 py-0.5 text-xs">
                {u}
                {canWrite && (
                  <button type="button" className="text-muted-foreground hover:text-destructive" aria-label={`Remove ${u}`} onClick={() => setUnits(units.filter((x) => x !== u))}>
                    ×
                  </button>
                )}
              </span>
            ))}
          </div>
          {canWrite && (
            <div className="flex gap-2">
              <Input
                value={newUnit}
                placeholder="Add a unit (e.g. gallon)"
                onChange={(e) => setNewUnit(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && newUnit.trim()) {
                    e.preventDefault();
                    setUnits([...units, newUnit.trim()]);
                    setNewUnit("");
                  }
                }}
              />
              <Button
                type="button"
                size="sm"
                disabled={!newUnit.trim() || units.includes(newUnit.trim())}
                onClick={() => {
                  setUnits([...units, newUnit.trim()]);
                  setNewUnit("");
                }}
              >
                Add
              </Button>
            </div>
          )}
          {canWrite && <Button size="sm" disabled={busy} onClick={() => void save("units", { units }, "Stock units saved")}>Save units</Button>}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Telegram bot</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <p className="text-xs text-muted-foreground">
            Member-facing notifications. The bot token is a sealed secret (set/rotate below). Multi-tenant setup wires each bot token to its tenant on first poll of the bot info.
          </p>
          <Field label="Display name (shown in the chat and notifications)"><Input value={telegram.botName} disabled={!canWrite} onChange={(e) => setTelegram({ ...telegram, botName: e.target.value })} /></Field>
          <Field label="Welcome message (shown on /start)"><Input value={telegram.welcomeMessage} disabled={!canWrite} onChange={(e) => setTelegram({ ...telegram, welcomeMessage: e.target.value })} /></Field>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={telegram.allowMemberLinking} disabled={!canWrite} onChange={(e) => setTelegram({ ...telegram, allowMemberLinking: e.target.checked })} />
            Allow members to link their Telegram account (self-service)
          </label>
          {canWrite && <Button size="sm" disabled={busy} onClick={() => void save("telegram", telegram, "Telegram bot settings saved")}>Save bot settings</Button>}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Feature flags &amp; retention</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          {Object.entries(settings.features).map(([k, v]) => (
            <label key={k} className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={v}
                disabled={!canWrite}
                onChange={(e) => void save("features", { [k]: e.target.checked }, `Flag ${k} ${e.target.checked ? "enabled" : "disabled"}`)}
              />
              Module {k}
            </label>
          ))}
          <div className="grid grid-cols-4 gap-2 pt-2">
            {(["outboxDays", "eventDays", "otpDays", "sessionDays"] as const).map((k) => (
              <Field key={k} label={k.replace("Days", "")}>
                <Input type="number" value={settings.retention[k]} disabled={!canWrite} onChange={(e) => void save("retention", { [k]: Number(e.target.value) }, `Retention ${k} saved`)} />
              </Field>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export function SecretForms() {
  const router = useRouter();
  const { push } = useToast();
  const [pay, setPay] = useState("");
  const [bot, setBot] = useState("");
  const [busy, setBusy] = useState(false);

  async function rotate(name: "paymentCredentials" | "telegramBotToken", value: string, clear: () => void) {
    setBusy(true);
    const r = await send("/api/settings/secrets", "POST", { name, value });
    setBusy(false);
    push(r.ok ? { title: "Secret sealed & rotated", variant: "success" } : { title: "Failed", description: r.message, variant: "destructive" });
    if (r.ok) {
      clear();
      router.refresh();
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <Input placeholder="new payment webhook secret" value={pay} onChange={(e) => setPay(e.target.value)} />
        <Button size="sm" variant="outline" disabled={busy || pay.length < 8} onClick={() => void rotate("paymentCredentials", pay, () => setPay(""))}>Rotate</Button>
      </div>
      <div className="flex gap-2">
        <Input placeholder="new telegram bot token" value={bot} onChange={(e) => setBot(e.target.value)} />
        <Button size="sm" variant="outline" disabled={busy || bot.length < 8} onClick={() => void rotate("telegramBotToken", bot, () => setBot(""))}>Rotate</Button>
      </div>
    </div>
  );
}

export function OpeningBalanceForm({ accounts, canWrite }: { accounts: Array<{ code: string; name: string }>; canWrite: boolean }) {
  const router = useRouter();
  const { push } = useToast();
  const [busy, setBusy] = useState(false);
  const [c1, setC1] = useState(accounts[0]?.code ?? "1100");
  const [a1, setA1] = useState("0");
  const [c2, setC2] = useState(accounts[1]?.code ?? "1300");
  const [a2, setA2] = useState("0");

  async function post() {
    setBusy(true);
    const r = await send("/api/settings/opening-balances", "POST", {
      lines: [
        { code: c1, direction: "debit", amountMinor: Math.round(Number(a1) * 100) },
        { code: c2, direction: "credit", amountMinor: Math.round(Number(a2) * 100) }
      ]
    });
    setBusy(false);
    push(r.ok ? { title: "Opening balance posted", variant: "success" } : { title: "Failed", description: r.message, variant: "destructive" });
    if (r.ok) router.refresh();
  }

  return (
    <Card>
      <CardHeader><CardTitle>Opening balances</CardTitle></CardHeader>
      <CardContent className="space-y-3">
        <p className="text-xs text-muted-foreground">Posts one balanced <code>opening</code> ledger transaction. Forward-only — mistakes are corrected by a reversing adjustment, never a rewrite.</p>
        <div className="flex items-center gap-2">
          <select className="h-9 rounded-md border bg-transparent px-2 text-sm" value={c1} disabled={!canWrite} onChange={(e) => setC1(e.target.value)}>
            {accounts.map((a) => <option key={a.code} value={a.code}>{a.code} {a.name}</option>)}
          </select>
          <Input type="number" className="w-28" value={a1} disabled={!canWrite} onChange={(e) => setA1(e.target.value)} />
          <span className="text-sm text-muted-foreground">debit</span>
        </div>
        <div className="flex items-center gap-2">
          <select className="h-9 rounded-md border bg-transparent px-2 text-sm" value={c2} disabled={!canWrite} onChange={(e) => setC2(e.target.value)}>
            {accounts.map((a) => <option key={a.code} value={a.code}>{a.code} {a.name}</option>)}
          </select>
          <Input type="number" className="w-28" value={a2} disabled={!canWrite} onChange={(e) => setA2(e.target.value)} />
          <span className="text-sm text-muted-foreground">credit</span>
        </div>
        <Button size="sm" disabled={!canWrite || busy || !a1 || a1 !== a2} onClick={() => void post()}>Post opening balances</Button>
        {a1 !== a2 && <p className="text-xs text-destructive">Debit and credit amounts must be equal (balanced posting).</p>}
      </CardContent>
    </Card>
  );
}
