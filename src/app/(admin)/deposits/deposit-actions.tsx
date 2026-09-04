"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Input, Label, Select, Textarea } from "@/components/ui/input";
import { useToast } from "@/components/toast";

interface DepositRef {
  id: string;
  leaseStatus: string;
  status: string;
  remainingMinor: number;
}

const SETTLEMENT_OPEN = ["notice", "completed", "terminated"];

export function DepositActions({
  deposit,
  canUpdate,
  canRefund
}: {
  deposit: DepositRef;
  canUpdate: boolean;
  canRefund: boolean;
}) {
  const router = useRouter();
  const { push } = useToast();
  const [busy, setBusy] = useState(false);
  const [deductOpen, setDeductOpen] = useState(false);
  const [refundOpen, setRefundOpen] = useState(false);

  const settlementOpen = SETTLEMENT_OPEN.includes(deposit.leaseStatus) && deposit.status !== "settled" && deposit.remainingMinor > 0;

  async function act(action: "deduct" | "refund", body: unknown) {
    setBusy(true);
    const res = await fetch(`/api/deposits/${deposit.id}/${action}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    });
    const data = (await res.json().catch(() => ({}))) as { message?: string; remainingMinor?: number; status?: string };
    setBusy(false);
    if (!res.ok) {
      push({ title: `${action} failed`, description: data.message, variant: "destructive" });
      return;
    }
    push({
      title: action === "deduct" ? "Deduction posted" : "Refund posted",
      description: `Remaining held: ${((data.remainingMinor ?? 0) / 100).toFixed(2)} · deposit ${data.status}`,
      variant: "success"
    });
    setDeductOpen(false);
    setRefundOpen(false);
    router.refresh();
  }

  if (!settlementOpen) {
    return <span className="text-xs text-muted-foreground">{deposit.status === "settled" ? "settled" : "—"}</span>;
  }

  return (
    <div className="flex justify-end gap-1.5">
      {canUpdate ? (
        <Button variant="destructive" size="sm" disabled={busy} onClick={() => setDeductOpen(true)}>
          Deduct…
        </Button>
      ) : null}
      {canRefund ? (
        <Button variant="secondary" size="sm" disabled={busy} onClick={() => setRefundOpen(true)}>
          Refund…
        </Button>
      ) : null}

      <Dialog
        open={deductOpen}
        onClose={() => setDeductOpen(false)}
        title="Deduct from deposit"
        description={`Held: ${(deposit.remainingMinor / 100).toFixed(2)} — deductions require an evidence document (photo/report uploaded to the registry) and are posted to the ledger immediately.`}
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const fd = new FormData(e.currentTarget);
            void act("deduct", {
              amount: Number(fd.get("amount")),
              reason: fd.get("reason"),
              evidenceDocId: fd.get("evidenceDocId"),
              note: fd.get("note")
            });
          }}
          className="space-y-4"
        >
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor={`dd-amount-${deposit.id}`}>Amount</Label>
              <Input
                id={`dd-amount-${deposit.id}`}
                name="amount"
                type="number"
                step="0.01"
                min="0.01"
                max={(deposit.remainingMinor / 100).toFixed(2)}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor={`dd-reason-${deposit.id}`}>Reason</Label>
              <Select id={`dd-reason-${deposit.id}`} name="reason" defaultValue="damage">
                {["damage", "cleaning", "unpaid_rent", "other"].map((r) => (
                  <option key={r} value={r}>
                    {r.replaceAll("_", " ")}
                  </option>
                ))}
              </Select>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor={`dd-evidence-${deposit.id}`}>Evidence document (registry id)</Label>
            <Input id={`dd-evidence-${deposit.id}`} name="evidenceDocId" placeholder="cuid of the uploaded doc" required />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor={`dd-note-${deposit.id}`}>Note</Label>
            <Textarea id={`dd-note-${deposit.id}`} name="note" rows={2} required minLength={3} maxLength={500} />
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setDeductOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="destructive" disabled={busy}>
              Post deduction
            </Button>
          </div>
        </form>
      </Dialog>

      <Dialog
        open={refundOpen}
        onClose={() => setRefundOpen(false)}
        title="Refund deposit remainder"
        description={`Returns the held ${(deposit.remainingMinor / 100).toFixed(2)} to the member. Accountant approval required; leave the amount empty to refund everything and settle the deposit.`}
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const fd = new FormData(e.currentTarget);
            const amount = String(fd.get("amount") ?? "").trim();
            void act("refund", {
              amount: amount === "" ? null : Number(amount),
              method: fd.get("method"),
              note: fd.get("note")
            });
          }}
          className="space-y-4"
        >
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor={`dr-amount-${deposit.id}`}>Amount (empty = full remainder)</Label>
              <Input
                id={`dr-amount-${deposit.id}`}
                name="amount"
                type="number"
                step="0.01"
                min="0.01"
                max={(deposit.remainingMinor / 100).toFixed(2)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor={`dr-method-${deposit.id}`}>Method</Label>
              <Select id={`dr-method-${deposit.id}`} name="method" defaultValue="bank_transfer">
                {["bank_transfer", "cash", "qr", "card", "cheque"].map((m) => (
                  <option key={m} value={m}>
                    {m.replaceAll("_", " ")}
                  </option>
                ))}
              </Select>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor={`dr-note-${deposit.id}`}>Note</Label>
            <Textarea id={`dr-note-${deposit.id}`} name="note" rows={2} required minLength={3} maxLength={500} />
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setRefundOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="secondary" disabled={busy}>
              Post refund
            </Button>
          </div>
        </form>
      </Dialog>
    </div>
  );
}
