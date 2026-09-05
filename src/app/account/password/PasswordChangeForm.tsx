"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { useToast } from "@/components/toast";
import { useTx } from "@/components/i18n-text";

export function PasswordChangeForm({ force }: { force: boolean }) {
  const router = useRouter();
  const tUi = useTx();
  const { push } = useToast();
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (next !== confirm) {
      setError(tUi("Passwords do not match"));
      return;
    }
    if (next.length < 8) {
      setError(tUi("Password must be at least 8 characters"));
      return;
    }
    setBusy(true);
    const res = await fetch("/api/auth/password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ currentPassword: current, password: next })
    });
    const data = (await res.json().catch(() => ({}))) as { message?: string };
    setBusy(false);
    if (!res.ok) {
      setError(data.message ?? tUi("Could not change password"));
      return;
    }
    push({
      title: tUi("Password changed"),
      description: force ? tUi("You can now use your own password") : undefined,
      variant: "success"
    });
    router.replace(force ? "/dashboard" : "/account");
    router.refresh();
  }

  return (
    <form onSubmit={submit} className="w-full max-w-md space-y-4 rounded-xl border bg-card p-6 shadow-sm">
      {force ? (
        <p className="text-sm text-muted-foreground">
          {tUi("Your administrator set a temporary password. Choose a strong password of your own to continue.")}
        </p>
      ) : null}
      <div className="space-y-1.5">
        <Label htmlFor="pwd-current">{tUi("Current password")}</Label>
        <Input
          id="pwd-current"
          type="password"
          autoComplete="current-password"
          value={current}
          onChange={(e) => setCurrent(e.target.value)}
          required
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="pwd-next">{tUi("New password")}</Label>
        <Input
          id="pwd-next"
          type="password"
          autoComplete="new-password"
          minLength={8}
          value={next}
          onChange={(e) => setNext(e.target.value)}
          required
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="pwd-confirm">{tUi("Repeat new password")}</Label>
        <Input
          id="pwd-confirm"
          type="password"
          autoComplete="new-password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          required
        />
      </div>
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      <Button type="submit" className="w-full" disabled={busy}>
        {busy ? tUi("Saving…") : tUi("Update password")}
      </Button>
    </form>
  );
}