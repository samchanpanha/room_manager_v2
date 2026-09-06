"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Input, Label, Select } from "@/components/ui/input";
import { useToast } from "@/components/toast";
import { Tx } from "@/components/i18n-text";

const PRICING_OPTIONS = [
  { value: "fixed_monthly", label: "Fixed monthly" },
  { value: "per_use", label: "Per use" },
  { value: "metered", label: "Metered" }
];

export function CatalogCreateDialog() {
  const router = useRouter();
  const { push } = useToast();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pricingModel, setPricingModel] = useState("fixed_monthly");

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    if (busy) return;
    const fd = new FormData(e.currentTarget);
    const payload = {
      code: String(fd.get("code") ?? "").trim().toUpperCase(),
      name: String(fd.get("name") ?? "").trim(),
      pricingModel: String(fd.get("pricingModel")),
      price: Number(fd.get("price")),
      unitLabel: String(fd.get("unitLabel") ?? "").trim() || undefined
    };
    setBusy(true);
    try {
      const res = await fetch("/api/services", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      const data = (await res.json().catch(() => ({}))) as { message?: string };
      if (!res.ok) return setError(data.message ?? "Could not create the service");
      push({ title: `Service ${payload.code} created`, variant: "success" });
      router.refresh();
      setOpen(false);
    } catch {
      setError("Could not create the service — please try again");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <Button size="sm" disabled={busy} onClick={() => setOpen(true)}>
        <Tx>New service</Tx>
      </Button>
      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title="New service"
        description="Catalog add-ons ride leases through the rent engine — fixed monthly prorates on suspend, per-use rides the next invoice, metered bills via M11 meters."
      >
        <form onSubmit={submit} className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="sc-code">Code</Label>
              <Input id="sc-code" name="code" placeholder="e.g. LAUNDRY" pattern="[A-Za-z0-9-]{2,20}" required maxLength={20} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="sc-name">Name</Label>
              <Input id="sc-name" name="name" placeholder="e.g. Self-service laundry" required minLength={2} maxLength={80} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="sc-model">Pricing model</Label>
            <Select id="sc-model" name="pricingModel" value={pricingModel} onChange={(e) => setPricingModel(e.target.value)}>
              {PRICING_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="sc-price">Price</Label>
            <Input id="sc-price" name="price" type="number" step="0.01" min="0" max="100000" required placeholder="25.00" />
            <p className="text-xs text-muted-foreground">
              {pricingModel === "fixed_monthly" ? <Tx>Monthly price per lease.</Tx> : <Tx>Price per unit (e.g. per wash, per GB).</Tx>}
            </p>
          </div>
          {pricingModel !== "fixed_monthly" ? (
            <div className="space-y-1.5">
              <Label htmlFor="sc-unit">Unit label</Label>
              <Input id="sc-unit" name="unitLabel" placeholder="e.g. kg, wash, GB" maxLength={20} />
            </div>
          ) : null}
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={busy}>
              Create
            </Button>
          </div>
        </form>
      </Dialog>
    </>
  );
}