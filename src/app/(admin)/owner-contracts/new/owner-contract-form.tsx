"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input, Label, Select, Textarea } from "@/components/ui/input";
import { useToast } from "@/components/toast";

export function OwnerContractForm({
  owners,
  buildings
}: {
  owners: Array<{ id: string; label: string }>;
  buildings: Array<{ id: string; label: string }>;
}) {
  const router = useRouter();
  const { push } = useToast();
  const [busy, setBusy] = useState(false);
  const [model, setModel] = useState<"REVENUE_SHARE" | "FIXED_RENT">("REVENUE_SHARE");
  const [startDate, setStartDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [endDate, setEndDate] = useState("");

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    setBusy(true);
    try {
      const res = await fetch("/api/owner-contracts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ownerProfileId: form.get("ownerProfileId"),
          buildingId: form.get("buildingId"),
          model,
          sharePercent: model === "REVENUE_SHARE" ? Number(form.get("sharePercent")) : null,
          fixedRent: model === "FIXED_RENT" ? Number(form.get("fixedRent")) : null,
          managementFeePercent: Number(form.get("managementFeePercent") || 0),
          startDate: new Date(`${startDate}T00:00:00.000Z`).toISOString(),
          endDate: endDate ? new Date(`${endDate}T00:00:00.000Z`).toISOString() : null,
          payoutCycleDay: Number(form.get("payoutCycleDay")),
          notes: form.get("notes") || undefined
        })
      });
      const body = (await res.json().catch(() => ({}))) as { id?: string; code?: string; message?: string };
      if (!res.ok || !body.id) {
        push({ title: "Could not create contract", description: body.message, variant: "destructive" });
        return;
      }
      push({ title: `Draft contract ${body.code} created`, description: "Activate it from the Leases page to sync building ownership.", variant: "success" });
      router.push("/leases?tab=contracts");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <CardContent className="p-6">
        <form onSubmit={submit} className="space-y-5">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="oc-owner">Owner *</Label>
              <Select id="oc-owner" name="ownerProfileId" required>
                <option value="">— select owner —</option>
                {owners.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.label}
                  </option>
                ))}
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="oc-building">Building (no open contract) *</Label>
              <Select id="oc-building" name="buildingId" required>
                <option value="">— select building —</option>
                {buildings.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.label}
                  </option>
                ))}
              </Select>
            </div>
          </div>

          <div className="space-y-3">
            <Label>Contract model *</Label>
            <div className="flex gap-4 text-sm">
              <label className="flex items-center gap-2">
                <input type="radio" name="model" checked={model === "REVENUE_SHARE"} onChange={() => setModel("REVENUE_SHARE")} className="h-4 w-4" />
                Revenue share (owner gets % of collected rent)
              </label>
              <label className="flex items-center gap-2">
                <input type="radio" name="model" checked={model === "FIXED_RENT"} onChange={() => setModel("FIXED_RENT")} className="h-4 w-4" />
                Fixed master rent (we pay the owner)
              </label>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              {model === "REVENUE_SHARE" ? (
                <div className="space-y-1.5">
                  <Label htmlFor="oc-share">Owner share % *</Label>
                  <Input id="oc-share" name="sharePercent" type="number" min="1" max="100" defaultValue={60} required />
                </div>
              ) : (
                <div className="space-y-1.5">
                  <Label htmlFor="oc-rent">Monthly master rent *</Label>
                  <Input id="oc-rent" name="fixedRent" type="number" step="0.01" min="0" required />
                </div>
              )}
              <div className="space-y-1.5">
                <Label htmlFor="oc-fee">Management fee % (deducted in statements)</Label>
                <Input id="oc-fee" name="managementFeePercent" type="number" min="0" max="50" defaultValue={0} />
              </div>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <div className="space-y-1.5">
              <Label htmlFor="oc-start">Start date *</Label>
              <Input id="oc-start" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} required />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="oc-end">End date (optional)</Label>
              <Input id="oc-end" type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} min={startDate} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="oc-payout">Payout cycle day (1–28)</Label>
              <Input id="oc-payout" name="payoutCycleDay" type="number" min="1" max="28" defaultValue={1} />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="oc-notes">Notes</Label>
            <Textarea id="oc-notes" name="notes" rows={2} />
          </div>

          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => router.push("/leases?tab=contracts")}>
              Cancel
            </Button>
            <Button type="submit" variant="success" disabled={busy}>
              {busy ? "Creating…" : "Create draft contract"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
