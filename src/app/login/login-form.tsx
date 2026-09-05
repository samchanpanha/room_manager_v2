"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { useT } from "@/components/i18n-provider";

export function Loginform() {
  const router = useRouter();
  const { t } = useT();
  const [email, setEmail] = useState("root@demo.test");
  const [password, setPassword] = useState("Demo1234!");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password })
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { message?: string } | null;
        setError(body?.message ?? t("auth.login.error"));
        return;
      }
      router.replace("/dashboard");
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4 rounded-xl border bg-card p-6 shadow-sm">
      <div className="space-y-1.5">
        <Label htmlFor="email">{t("auth.login.email")}</Label>
        <Input id="email" type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} required />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="password">{t("auth.login.password")}</Label>
        <Input
          id="password"
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
      </div>
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      <Button type="submit" className="w-full" disabled={busy}>
        {busy ? t("auth.login.signingIn") : t("auth.login.submit")}
      </Button>
    </form>
  );
}
