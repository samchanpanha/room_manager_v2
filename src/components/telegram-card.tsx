"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/components/toast";

interface LinkState {
  linked: boolean;
  principalType?: string;
  linkedAt?: string;
  chatMasked?: string;
  displayName?: string;
  prefs?: Record<string, boolean>;
}

const PREF_LABELS: Array<[string, string]> = [
  ["invoiceIssued", "Invoice issued"],
  ["paymentReceived", "Payment received"],
  ["overdueReminder", "Overdue reminders"],
  ["ticketUpdates", "Ticket updates"],
  ["complaintUpdates", "Complaint updates"],
  ["lowStock", "Low stock (staff)"],
  ["statementReady", "Statement ready"],
  ["occupancyDigest", "Occupancy digest (staff)"]
];

/// §M21 "user sees one-time link code in app" + preference toggles — used on
/// the tenant portal (Me) and the owner portal.
export function TelegramCard() {
  const { push } = useToast();
  const [state, setState] = useState<LinkState | null>(null);
  const [code, setCode] = useState<{ code: string; deepLink: string; expiresAt: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const res = await fetch("/api/telegram/link-state");
    if (res.ok) setState((await res.json()) as LinkState);
  }, []);
  useEffect(() => {
    void load();
  }, [load]);

  async function generate() {
    setBusy(true);
    const res = await fetch("/api/telegram/link-code", { method: "POST" });
    const data = (await res.json().catch(() => ({}))) as { code?: string; deepLink?: string; expiresAt?: string; message?: string };
    setBusy(false);
    if (!res.ok || !data.code) {
      push({ title: "Could not create a code", description: data.message, variant: "destructive" });
      return;
    }
    setCode({ code: data.code, deepLink: data.deepLink!, expiresAt: data.expiresAt! });
  }

  async function unlink() {
    setBusy(true);
    const res = await fetch("/api/telegram/unlink", { method: "POST" });
    setBusy(false);
    if (!res.ok) {
      push({ title: "Unlink failed", variant: "destructive" });
      return;
    }
    push({ title: "Chat unlinked", variant: "success" });
    setCode(null);
    void load();
  }

  async function togglePref(key: string, value: boolean) {
    const res = await fetch("/api/telegram/prefs", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prefs: { [key]: value } })
    });
    if (!res.ok) {
      push({ title: "Could not save the toggle", variant: "destructive" });
      return;
    }
    setState((s) => (s ? { ...s, prefs: { ...(s.prefs ?? {}), [key]: value } } : s));
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm">Telegram updates</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        {!state ? (
          <p className="text-muted-foreground">Loading…</p>
        ) : !state.linked ? (
          <>
            <p className="text-muted-foreground">Get rent receipts and updates in Telegram. Generate a code, then send <span className="font-mono">/link &lt;code&gt;</span> to the bot.</p>
            {code ? (
              <div className="rounded-md border border-dashed px-3 py-2">
                <p className="text-xs text-muted-foreground">One-time code (expires {new Date(code.expiresAt).toLocaleTimeString()}):</p>
                <p className="font-mono text-lg font-semibold tracking-widest">{code.code}</p>
                <a href={code.deepLink} target="_blank" rel="noreferrer" className="text-xs underline underline-offset-4">
                  Open the bot →
                </a>
              </div>
            ) : (
              <Button size="sm" onClick={generate} disabled={busy}>
                Generate link code
              </Button>
            )}
          </>
        ) : (
          <>
            <p className="text-muted-foreground">
              Linked{state.displayName ? ` to ${state.displayName}` : ""} · chat {state.chatMasked} · since{" "}
              {state.linkedAt ? new Date(state.linkedAt).toLocaleDateString() : "—"}
            </p>
            <div className="space-y-1.5">
              {PREF_LABELS.map(([key, label]) => (
                <label key={key} className="flex items-center justify-between gap-3 text-xs">
                  <span>{label}</span>
                  <input
                    type="checkbox"
                    className="h-4 w-4"
                    checked={state.prefs?.[key] ?? false}
                    onChange={(e) => void togglePref(key, e.target.checked)}
                  />
                </label>
              ))}
            </div>
            <Button size="sm" variant="outline" onClick={unlink} disabled={busy}>
              Unlink chat
            </Button>
          </>
        )}
      </CardContent>
    </Card>
  );
}
