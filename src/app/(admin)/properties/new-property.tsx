"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Input, Label, Textarea } from "@/components/ui/input";
import { useToast } from "@/components/toast";

export function NewPropertyButton() {
  const router = useRouter();
  const { push } = useToast();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    setBusy(true);
    try {
      const res = await fetch("/api/properties", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.get("name"),
          code: String(form.get("code") ?? "").toUpperCase(),
          address: form.get("address") || undefined
        })
      });
      const body = (await res.json().catch(() => ({}))) as { message?: string };
      if (!res.ok) {
        push({ title: "Could not create property", description: body.message, variant: "destructive" });
        return;
      }
      push({ title: "Property created", variant: "success" });
      setOpen(false);
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <Button onClick={() => setOpen(true)}>+ New property</Button>
      <Dialog open={open} onClose={() => setOpen(false)} title="New property" description="Top of the hierarchy: property → building → floor → room.">
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="p-name">Name</Label>
            <Input id="p-name" name="name" placeholder="Bassac Lane Residence" required minLength={2} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="p-code">Code</Label>
            <Input id="p-code" name="code" placeholder="BLR" required pattern="[A-Za-z0-9]{2,16}" />
            <p className="text-xs text-muted-foreground">Uppercase letters/digits. Used in invoice numbering.</p>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="p-address">Address</Label>
            <Textarea id="p-address" name="address" rows={2} placeholder="Street, district, city" />
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={busy}>
              {busy ? "Creating…" : "Create property"}
            </Button>
          </div>
        </form>
      </Dialog>
    </>
  );
}
