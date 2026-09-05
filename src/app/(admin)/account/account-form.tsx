"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { useToast } from "@/components/toast";
import { useTx } from "@/components/i18n-text";

export function AccountForm({ initialName, email, roles }: { initialName: string; email: string; roles: string[] }) {
  const router = useRouter();
  const tUi = useTx();
  const { push } = useToast();
  const [name, setName] = useState(initialName);
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);

  async function saveName() {
    if (name.trim().length < 2) return;
    setBusy(true);
    const res = await fetch("/api/account", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: name.trim() })
    });
    setBusy(false);
    push(res.ok ? { title: tUi("Profile updated"), variant: "success" } : { title: tUi("Failed"), variant: "destructive" });
    if (res.ok) router.refresh();
  }

  async function changePassword(e: React.FormEvent) {
    e.preventDefault();
    if (next !== confirm) {
      push({ title: tUi("Passwords do not match"), variant: "destructive" });
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
    push(
      res.ok
        ? { title: tUi("Password changed"), variant: "success" }
        : { title: tUi("Could not change password"), description: data.message, variant: "destructive" }
    );
    if (res.ok) {
      setCurrent("");
      setNext("");
      setConfirm("");
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <div className="space-y-4">
        <div className="rounded-lg border bg-card p-4">
          <h2 className="text-sm font-semibold">{tUi("Profile")}</h2>
          <p className="mt-1 text-xs text-muted-foreground">{email}</p>
          <p className="mt-1 text-xs text-muted-foreground">{roles.map((r) => r.replaceAll("_", " ").toLowerCase()).join(" · ")}</p>
          <div className="mt-3 space-y-1.5">
            <Label htmlFor="acc-name">{tUi("Display name")}</Label>
            <Input id="acc-name" value={name} onChange={(e) => setName(e.target.value)} minLength={2} />
          </div>
          <div className="mt-3 flex justify-end">
            <Button size="sm" disabled={busy || name.trim().length < 2} onClick={() => void saveName()}>
              {tUi("Save name")}
            </Button>
          </div>
        </div>
      </div>

      <form onSubmit={changePassword} className="space-y-4 rounded-lg border bg-card p-4">
        <h2 className="text-sm font-semibold">{tUi("Change password")}</h2>
        <div className="space-y-1.5">
          <Label htmlFor="acc-current">{tUi("Current password")}</Label>
          <Input id="acc-current" type="password" autoComplete="current-password" value={current} onChange={(e) => setCurrent(e.target.value)} required />
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="acc-next">{tUi("New password")}</Label>
            <Input id="acc-next" type="password" autoComplete="new-password" minLength={8} value={next} onChange={(e) => setNext(e.target.value)} required />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="acc-confirm">{tUi("Repeat new password")}</Label>
            <Input id="acc-confirm" type="password" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} required />
          </div>
        </div>
        <div className="flex justify-end">
          <Button type="submit" size="sm" disabled={busy}>
            {busy ? tUi("Saving…") : tUi("Update password")}
          </Button>
        </div>
      </form>
    </div>
  );
}