"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input, Label } from "@/components/ui/input";
import { useT } from "@/components/i18n-provider";

/// §M25 OTP login: identifier (party email or phone) → 6-digit code. The dev
/// echo code is shown inline (demo has no mail/SMS provider yet — M21/M28).
export function LoginForm() {
  const router = useRouter();
  const { tUi } = useT();
  const [step, setStep] = useState<"identifier" | "code">("identifier");
  const [identifier, setIdentifier] = useState("");
  const [code, setCode] = useState("");
  const [devCode, setDevCode] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function request(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const res = await fetch("/api/portal/otp/request", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ identifier })
    });
    const data = (await res.json().catch(() => ({}))) as { delivered?: boolean; devCode?: string; message?: string };
    setBusy(false);
    if (!res.ok) {
      setError(data.message ?? "Could not send the code");
      return;
    }
    if (!data.delivered) {
      setError(tUi("We could not find a resident with that email or phone. Please check with reception."));
      return;
    }
    if (data.devCode) setDevCode(data.devCode);
    setStep("code");
  }

  async function verify(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const res = await fetch("/api/portal/otp/verify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ identifier, code })
    });
    const data = (await res.json().catch(() => ({}))) as { name?: string; message?: string };
    setBusy(false);
    if (!res.ok) {
      setError(data.message ?? "Could not verify the code");
      return;
    }
    router.replace("/portal");
    router.refresh();
  }

  return (
    <Card className="w-full">
      <CardContent className="p-6">
        <h1 className="text-xl font-semibold tracking-tight">{tUi("Resident sign-in")}</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {step === "identifier"
            ? tUi("Enter the email or phone number you registered with.")
            : tUi("We sent a 6-digit code to {identifier}.").replace("{identifier}", identifier)}
        </p>

        {step === "identifier" ? (
          <form onSubmit={request} className="mt-5 space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="identifier">Email or phone</Label>
              <Input id="identifier" value={identifier} onChange={(e) => setIdentifier(e.target.value)} autoComplete="username" required />
            </div>
            <Button type="submit" className="w-full" disabled={busy || identifier.trim().length < 3}>
              {busy ? "Sending…" : "Send code"}
            </Button>
          </form>
        ) : (
          <form onSubmit={verify} className="mt-5 space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="code">6-digit code</Label>
              <Input id="code" inputMode="numeric" pattern="\d{6}" maxLength={6} value={code} onChange={(e) => setCode(e.target.value)} autoComplete="one-time-code" required />
            </div>
            {devCode ? (
              <p className="rounded-md border border-dashed px-3 py-2 text-xs text-muted-foreground">
                {tUi("Demo mode — your code is")} <span className="font-mono font-semibold text-foreground">{devCode}</span>
              </p>
            ) : null}
            <Button type="submit" className="w-full" disabled={busy || code.length !== 6}>
              {busy ? "Checking…" : "Sign in"}
            </Button>
            <button
              type="button"
              className="w-full text-xs text-muted-foreground underline underline-offset-4"
              onClick={() => {
                setStep("identifier");
                setCode("");
                setDevCode(null);
              }}
            >
              {tUi("Use a different email or phone")}
            </button>
          </form>
        )}

        {error ? <p className="mt-4 text-sm text-destructive">{error}</p> : null}
      </CardContent>
    </Card>
  );
}
