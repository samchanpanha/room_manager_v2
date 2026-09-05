"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input, Label, Select, Textarea } from "@/components/ui/input";
import { useToast } from "@/components/toast";
import { Tx } from "@/components/i18n-text";

interface BuildingOpt {
  id: string;
  label: string;
}

export function NewOwnerForm({ unownedBuildings }: { unownedBuildings: BuildingOpt[] }) {
  const router = useRouter();
  const { push } = useToast();
  const [busy, setBusy] = useState(false);
  const [withPayout, setWithPayout] = useState(true);
  const [withLogin, setWithLogin] = useState(true);
  const [buildingIds, setBuildingIds] = useState<Set<string>>(new Set());

  function toggleBuilding(id: string) {
    setBuildingIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    setBusy(true);
    try {
      const res = await fetch("/api/owners", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.get("name"),
          email: form.get("email") || undefined,
          phone: form.get("phone") || undefined,
          companyName: form.get("companyName") || undefined,
          notes: form.get("notes") || undefined,
          payoutMethod: withPayout
            ? {
                kind: form.get("kind"),
                bankName: form.get("bankName") || undefined,
                accountName: form.get("accountName"),
                accountNumber: form.get("accountNumber")
              }
            : undefined,
          buildingIds: [...buildingIds],
          portalLogin: withLogin
            ? { email: form.get("loginEmail"), password: form.get("loginPassword") }
            : undefined
        })
      });
      const body = (await res.json().catch(() => ({}))) as { id?: string; message?: string };
      if (!res.ok || !body.id) {
        push({ title: "Could not create owner", description: body.message, variant: "destructive" });
        return;
      }
      push({ title: "Owner onboarded", variant: "success" });
      router.push(`/owners/${body.id}`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <CardContent className="p-6">
        <form onSubmit={submit} className="space-y-6">
          <section className="space-y-3">
            <p className="text-sm font-medium"><Tx>Identity</Tx></p>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="o-name">Full name *</Label>
                <Input id="o-name" name="name" required minLength={2} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="o-company">Company (optional)</Label>
                <Input id="o-company" name="companyName" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="o-email">Email</Label>
                <Input id="o-email" name="email" type="email" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="o-phone">Phone</Label>
                <Input id="o-phone" name="phone" />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="o-notes">Notes</Label>
              <Textarea id="o-notes" name="notes" rows={2} />
            </div>
          </section>

          <section className="space-y-3">
            <label className="flex items-center gap-2 text-sm font-medium">
              <input type="checkbox" checked={withPayout} onChange={(e) => setWithPayout(e.target.checked)} className="h-4 w-4" />
              Payout method (primary)
            </label>
            {withPayout ? (
              <div className="grid gap-3 rounded-lg border p-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="o-kind">Kind</Label>
                  <Select id="o-kind" name="kind" defaultValue="BANK">
                    <option value="BANK">Bank transfer</option>
                    <option value="MOBILE_MONEY">Mobile money</option>
                    <option value="CASH">Cash</option>
                    <option value="OTHER">Other</option>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="o-bank">Bank / provider</Label>
                  <Input id="o-bank" name="bankName" placeholder="ABA Bank / Wing…" />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="o-accname">Account name *</Label>
                  <Input id="o-accname" name="accountName" required={withPayout} minLength={2} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="o-accno">Account number *</Label>
                  <Input id="o-accno" name="accountNumber" required={withPayout} minLength={3} />
                </div>
              </div>
            ) : null}
          </section>

          <section className="space-y-3">
            <p className="text-sm font-medium"><Tx>Buildings owned (optional)</Tx></p>
            {unownedBuildings.length === 0 ? (
              <p className="text-sm text-muted-foreground"><Tx>No unassigned buildings — every building already has an owner.</Tx></p>
            ) : (
              <div className="max-h-40 space-y-1.5 overflow-y-auto rounded-md border p-2">
                {unownedBuildings.map((b) => (
                  <label key={b.id} className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      className="h-4 w-4"
                      checked={buildingIds.has(b.id)}
                      onChange={() => toggleBuilding(b.id)}
                    />
                    {b.label}
                  </label>
                ))}
              </div>
            )}
            <p className="text-xs text-muted-foreground">
              <Tx>Every building links to exactly one owner; owner contracts (M05, Phase 5) formalize the terms.</Tx>
            </p>
          </section>

          <section className="space-y-3">
            <label className="flex items-center gap-2 text-sm font-medium">
              <input type="checkbox" checked={withLogin} onChange={(e) => setWithLogin(e.target.checked)} className="h-4 w-4" />
              Create portal login (OWNER role — sees only their buildings, statements, documents)
            </label>
            {withLogin ? (
              <div className="grid gap-3 rounded-lg border p-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="o-login-email">Login email *</Label>
                  <Input id="o-login-email" name="loginEmail" type="email" required={withLogin} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="o-login-pass">Temporary password * (min 8)</Label>
                  <Input id="o-login-pass" name="loginPassword" type="password" required={withLogin} minLength={8} />
                </div>
              </div>
            ) : null}
          </section>

          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => router.push("/owners")}>
              Cancel
            </Button>
            <Button type="submit" variant="success" disabled={busy}>
              {busy ? "Creating…" : "Create owner"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
