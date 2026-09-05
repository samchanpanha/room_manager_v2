"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { useToast } from "@/components/toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tx } from "@/components/i18n-text";

async function send(url: string, method: string, body?: unknown): Promise<{ ok: boolean; message?: string; data?: Record<string, unknown> }> {
  const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: body === undefined ? undefined : JSON.stringify(body) });
  const data = (await res.json().catch(() => ({}))) as { message?: string };
  return { ok: res.ok, message: data.message, data };
}

interface SessionRow {
  id: string;
  userAgent: string | null;
  ip: string | null;
  createdAt: Date;
  revokedAt: Date | null;
  current: boolean;
}

export function SecurityPanel({
  email,
  totpEnabled,
  enrollmentStarted,
  enrollmentRequired,
  isAdmin,
  isSuperAdmin,
  sessions,
  adminsWithTotp
}: {
  email: string;
  totpEnabled: boolean;
  enrollmentStarted: boolean;
  enrollmentRequired: boolean;
  isAdmin: boolean;
  isSuperAdmin: boolean;
  sessions: SessionRow[];
  adminsWithTotp: Array<{ id: string; name: string; email: string }>;
}) {
  const router = useRouter();
  const { push } = useToast();
  const [busy, setBusy] = useState(false);
  const [qr, setQr] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [verifyStatus, setVerifyStatus] = useState<string | null>(null);

  async function run<T extends { ok: boolean; message?: string }>(fn: () => Promise<T>, okTitle: string): Promise<T> {
    setBusy(true);
    const r = await fn();
    setBusy(false);
    push(r.ok ? { title: okTitle, variant: "success" } : { title: "Failed", description: r.message, variant: "destructive" });
    if (r.ok) router.refresh();
    return r;
  }

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <Card>
        <CardHeader><CardTitle>Two-factor authentication (TOTP)</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          {enrollmentRequired && (
            <p className="rounded-md border border-amber-500/50 bg-amber-500/10 p-2 text-sm text-amber-600 dark:text-amber-400">
              <Tx>2FA is mandatory for your role — enroll below. All other module capabilities are locked until a second factor is verified.</Tx>
            </p>
          )}
          <p className="text-sm">
            Status: {totpEnabled ? "enabled (TOTP verified at login)" : enrollmentStarted ? "enrollment started, not verified" : "not enrolled"}
            {isAdmin && !totpEnabled ? " — mandatory for Admin+" : ""}
          </p>
          {!totpEnabled && (
            <div className="flex flex-wrap items-center gap-2">
              <Button
                size="sm"
                disabled={busy}
                onClick={async () => {
                  const r = await run(() => send("/api/auth/2fa/setup", "POST"), "Enrollment started — scan the QR");
                  if (r.ok) setQr((r.data as { qrDataUrl?: string } | undefined)?.qrDataUrl ?? null);
                }}
              >
                {enrollmentStarted ? "Re-start enrollment" : "Start enrollment"}
              </Button>
              <div className="flex items-center gap-2">
                <Input className="w-24" placeholder="123456" value={code} onChange={(e) => setCode(e.target.value)} maxLength={6} />
                <Button
                  size="sm"
                  variant="outline"
                  disabled={busy || code.length !== 6}
                  onClick={() => void run(() => send("/api/auth/2fa/enable", "POST", { code }), "2FA enabled — codes now required at login")}
                >
                  Verify &amp; enable
                </Button>
              </div>
              {!isAdmin && (
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={busy || code.length !== 6}
                  onClick={() => void run(() => send("/api/auth/2fa/disable", "POST", { code }), "2FA disabled")}
                >
                  Disable with code
                </Button>
              )}
            </div>
          )}
          {qr && (
            <div className="space-y-1">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={qr} alt="TOTP QR code" width={180} height={180} />
              <p className="text-xs text-muted-foreground">Scan with your authenticator app for {email}, then verify a current code.</p>
            </div>
          )}
          {isSuperAdmin && adminsWithTotp.length > 0 && (
            <div className="space-y-1 border-t pt-2">
              <Label>Admin reset (Super Admin)</Label>
              {adminsWithTotp.map((a) => (
                <div key={a.id} className="flex items-center justify-between text-sm">
                  <span>{a.name} ({a.email})</span>
                  <Button size="sm" variant="outline" disabled={busy} onClick={() => void run(() => send("/api/auth/2fa/admin-reset", "POST", { userId: a.id }), `2FA reset for ${a.email}`)}>
                    Reset 2FA
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Devices &amp; sessions</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          {sessions.map((s) => (
            <div key={s.id} className="flex items-center justify-between gap-2 border-b pb-2 text-sm last:border-0">
              <div className="min-w-0">
                <p className="truncate">{(s.userAgent ?? "unknown device").slice(0, 60)}</p>
                <p className="text-xs text-muted-foreground">
                  {s.ip ?? "no ip"} · started {s.createdAt.toISOString().slice(0, 16).replace("T", " ")}
                  {s.revokedAt ? " · revoked" : ""}
                  {s.current ? " · this device" : ""}
                </p>
              </div>
              {!s.revokedAt && (
                <Button size="sm" variant="outline" disabled={busy} onClick={() => void run(() => send(`/api/auth/sessions/${s.id}`, "DELETE"), s.current ? "Signed out of this device" : "Session revoked")}>
                  Revoke
                </Button>
              )}
            </div>
          ))}
          <div className="flex items-center justify-between border-t pt-3">
            <span className="text-sm text-muted-foreground"><Tx>Audit trail tamper-evidence</Tx></span>
            <Button
              size="sm"
              variant="outline"
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                const r = await send("/api/audit/verify", "GET");
                setBusy(false);
                const d = r.data as { ok?: boolean; checked?: number } | undefined;
                if (r.ok && d) {
                  setVerifyStatus(d.ok ? `chain intact (${d.checked} rows)` : `TAMPER DETECTED`);
                  push({ title: d.ok ? "Audit chain intact" : "Tamper detected!", variant: d.ok ? "success" : "destructive" });
                } else {
                  push({ title: "Failed", description: r.message, variant: "destructive" });
                }
              }}
            >
              Verify chain
            </Button>
          </div>
          {verifyStatus && <p className="text-xs text-muted-foreground">{verifyStatus}</p>}
        </CardContent>
      </Card>
    </div>
  );
}
