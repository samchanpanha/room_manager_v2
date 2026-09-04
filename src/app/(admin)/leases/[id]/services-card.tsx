"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input, Select } from "@/components/ui/input";
import { useToast } from "@/components/toast";

interface ServiceView {
  id: string;
  name: string;
  amountMinor: number;
  pricingModel: string;
}

export function ServicesCard({
  leaseId,
  status,
  services,
  canUpdate
}: {
  leaseId: string;
  status: string;
  services: ServiceView[];
  canUpdate: boolean;
}) {
  const router = useRouter();
  const { push } = useToast();
  const [busy, setBusy] = useState(false);
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState("");
  const [amount, setAmount] = useState("");
  const [model, setModel] = useState("fixed_monthly");

  const ended = status === "terminated" || status === "completed";
  const money = (m: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(m / 100);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const res = await fetch(`/api/leases/${leaseId}/services`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, amount: Number(amount), pricingModel: model })
    });
    const body = (await res.json().catch(() => ({}))) as { message?: string };
    setBusy(false);
    if (!res.ok) {
      push({ title: "Could not add service", description: body.message, variant: "destructive" });
      return;
    }
    push({ title: "Service added", variant: "success" });
    setName("");
    setAmount("");
    setAdding(false);
    router.refresh();
  }

  async function remove(id: string, svcName: string) {
    if (!window.confirm(`Remove "${svcName}" from this draft lease?`)) return;
    setBusy(true);
    const res = await fetch(`/api/lease-services/${id}`, { method: "DELETE" });
    const body = (await res.json().catch(() => ({}))) as { message?: string };
    setBusy(false);
    if (!res.ok) {
      push({ title: "Remove failed", description: body.message, variant: "destructive" });
      return;
    }
    push({ title: "Service removed", variant: "success" });
    router.refresh();
  }

  return (
    <Card>
      <CardContent className="p-5">
        <div className="mb-3 flex items-center justify-between">
          <p className="text-sm font-medium">Included services</p>
          {canUpdate && !ended ? (
            <Button size="sm" variant="outline" onClick={() => setAdding((v) => !v)}>
              {adding ? "Cancel" : "+ Add service"}
            </Button>
          ) : null}
        </div>
        {adding ? (
          <form onSubmit={add} className="mb-3 grid grid-cols-[1fr_120px_140px_auto] gap-2">
            <Input placeholder="Service (e.g. WiFi)" value={name} onChange={(e) => setName(e.target.value)} required minLength={2} />
            <Input placeholder="Amount" type="number" step="0.01" min="0" value={amount} onChange={(e) => setAmount(e.target.value)} required />
            <Select value={model} onChange={(e) => setModel(e.target.value)}>
              <option value="fixed_monthly">fixed monthly</option>
              <option value="per_use">per use</option>
              <option value="metered">metered</option>
            </Select>
            <Button type="submit" size="sm" disabled={busy}>
              Add
            </Button>
          </form>
        ) : null}
        {services.length === 0 ? (
          <p className="text-sm text-muted-foreground">None — add-ons (WiFi, parking…) appear on invoices from Phase 10.</p>
        ) : (
          <ul className="divide-y text-sm">
            {services.map((s) => (
              <li key={s.id} className="flex items-center justify-between py-2">
                <span>{s.name}</span>
                <span className="flex items-center gap-3">
                  <span className="tabular-nums">{money(s.amountMinor)}/mo</span>
                  {canUpdate && status === "draft" ? (
                    <Button size="sm" variant="ghost" className="text-destructive" disabled={busy} onClick={() => remove(s.id, s.name)}>
                      ✕
                    </Button>
                  ) : (
                    <span className="text-xs text-muted-foreground">{s.pricingModel.replaceAll("_", " ")}</span>
                  )}
                </span>
              </li>
            ))}
          </ul>
        )}
        {status === "draft" && canUpdate ? (
          <p className="mt-2 text-xs text-muted-foreground">Editable while drafting — immutable after activation.</p>
        ) : null}
      </CardContent>
    </Card>
  );
}
