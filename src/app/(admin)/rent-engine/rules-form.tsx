"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input, Label, Select } from "@/components/ui/input";
import { useToast } from "@/components/toast";
import { Tx } from "@/components/i18n-text";

interface Initial {
  graceDays: number;
  lateFeeType: string;
  lateFeeAmount: string;
  lateFeePercent: string;
  lateFeeCap: string;
  taxPercent: string;
  generationLeadDays: number;
}

export function RulesForm({ canEdit, initial }: { canEdit: boolean; initial: Initial }) {
  const router = useRouter();
  const { push } = useToast();
  const [busy, setBusy] = useState(false);
  const [type, setType] = useState(initial.lateFeeType);

  async function save(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    setBusy(true);
    const payload: Record<string, unknown> = {
      graceDays: Number(form.get("graceDays")),
      lateFeeType: form.get("lateFeeType"),
      taxPercent: Number(form.get("taxPercent")),
      generationLeadDays: Number(form.get("generationLeadDays"))
    };
    if (payload.lateFeeType === "FIXED") payload.lateFeeAmount = Number(form.get("lateFeeAmount"));
    else payload.lateFeePercent = Number(form.get("lateFeePercent"));
    payload.lateFeeCap = Number(form.get("lateFeeCap"));

    const res = await fetch("/api/rent-engine/rules", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    const data = (await res.json().catch(() => ({}))) as { message?: string };
    setBusy(false);
    if (!res.ok) {
      push({ title: "Save failed", description: data.message, variant: "destructive" });
      return;
    }
    push({ title: "Rules saved", description: "Applies forward-only — posted invoices are never rewritten.", variant: "success" });
    router.refresh();
  }

  return (
    <form onSubmit={save} className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="re-grace">Late fee grace days</Label>
          <Input id="re-grace" name="graceDays" type="number" min="0" max="90" defaultValue={initial.graceDays} disabled={!canEdit} required />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="re-type">Late fee type</Label>
          <Select id="re-type" name="lateFeeType" value={type} onChange={(e) => setType(e.target.value)} disabled={!canEdit}>
            <option value="FIXED"><Tx>Fixed amount</Tx></option>
            <option value="PERCENT"><Tx>Percent of outstanding</Tx></option>
          </Select>
        </div>
        {type === "FIXED" ? (
          <div className="space-y-1.5">
            <Label htmlFor="re-amt">Late fee amount</Label>
            <Input id="re-amt" name="lateFeeAmount" type="number" step="0.01" min="0" defaultValue={initial.lateFeeAmount} disabled={!canEdit} />
          </div>
        ) : (
          <div className="space-y-1.5">
            <Label htmlFor="re-pct">Late fee percent</Label>
            <Input id="re-pct" name="lateFeePercent" type="number" step="0.01" min="0" max="100" defaultValue={initial.lateFeePercent} disabled={!canEdit} />
          </div>
        )}
        <div className="space-y-1.5">
          <Label htmlFor="re-cap">Late fee cap</Label>
          <Input id="re-cap" name="lateFeeCap" type="number" step="0.01" min="0" defaultValue={initial.lateFeeCap} disabled={!canEdit} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="re-tax">Tax percent (default rule)</Label>
          <Input id="re-tax" name="taxPercent" type="number" step="0.01" min="0" max="100" defaultValue={initial.taxPercent} disabled={!canEdit} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="re-lead">Generation lead days</Label>
          <Input id="re-lead" name="generationLeadDays" type="number" min="0" max="28" defaultValue={initial.generationLeadDays} disabled={!canEdit} required />
        </div>
      </div>
      {canEdit ? (
        <div className="flex justify-end">
          <Button type="submit" size="sm" disabled={busy}>
            {busy ? "Saving…" : "Save rules"}
          </Button>
        </div>
      ) : (
        <p className="text-xs text-muted-foreground"><Tx>Read-only — M06:update required to change billing rules.</Tx></p>
      )}
    </form>
  );
}
