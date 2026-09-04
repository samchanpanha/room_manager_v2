"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Input, Label } from "@/components/ui/input";
import { useToast } from "@/components/toast";

export function NewRoleButton() {
  const router = useRouter();
  const { push } = useToast();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    setBusy(true);
    const res = await fetch("/api/roles", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        key: String(form.get("key") ?? "").toUpperCase(),
        name: form.get("name"),
        description: form.get("description") || undefined
      })
    });
    const body = (await res.json().catch(() => ({}))) as { message?: string; id?: string };
    setBusy(false);
    if (!res.ok) {
      push({ title: "Could not create role", description: body.message, variant: "destructive" });
      return;
    }
    push({ title: "Role created — now tick its permission grid", variant: "success" });
    setOpen(false);
    router.refresh();
    if (body.id) router.push(`/roles/${body.id}`);
  }

  return (
    <>
      <Button onClick={() => setOpen(true)}>+ New role</Button>
      <Dialog open={open} onClose={() => setOpen(false)} title="New role" description="Start empty, then grant module × action × scope on the grid.">
        <form onSubmit={submit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="role-key">Key (UPPER_SNAKE)</Label>
              <Input id="role-key" name="key" placeholder="CASHIER" required pattern="[A-Za-z][A-Za-z0-9_]{1,39}" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="role-name">Name</Label>
              <Input id="role-name" name="name" placeholder="Cashier" required minLength={2} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="role-desc">Description</Label>
            <Input id="role-desc" name="description" placeholder="Collects payments at the front desk" />
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={busy}>
              {busy ? "Creating…" : "Create role"}
            </Button>
          </div>
        </form>
      </Dialog>
    </>
  );
}

export function DeleteRoleButton({ id, name, inUse }: { id: string; name: string; inUse: boolean }) {
  const router = useRouter();
  const { push } = useToast();
  const [busy, setBusy] = useState(false);

  async function del() {
    if (inUse) {
      push({ title: "Role is in use", description: "Unassign it from all users first.", variant: "destructive" });
      return;
    }
    if (!window.confirm(`Delete role "${name}"? This cannot be undone.`)) return;
    setBusy(true);
    const res = await fetch(`/api/roles/${id}`, { method: "DELETE" });
    const body = (await res.json().catch(() => ({}))) as { message?: string };
    setBusy(false);
    if (!res.ok) {
      push({ title: "Delete failed", description: body.message, variant: "destructive" });
      return;
    }
    push({ title: "Role deleted", variant: "success" });
    router.refresh();
  }

  return (
    <Button size="sm" variant="ghost" className="text-destructive" disabled={busy} onClick={del}>
      Delete
    </Button>
  );
}
