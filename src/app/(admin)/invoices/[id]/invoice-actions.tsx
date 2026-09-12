"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Input, Label, Textarea } from "@/components/ui/input";
import { useToast } from "@/components/toast";

export function InvoiceActions({
  invoice,
  flags
}: {
  invoice: { id: string; code: string; status: string; amountDueMinor: number; memberProfileId?: string; memberName?: string };
  flags: { canIssue: boolean; canVoid: boolean; canCredit: boolean; canRecordPayment?: boolean };
}) {
  const router = useRouter();
  const { push } = useToast();
  const [busy, setBusy] = useState(false);
  const [voidOpen, setVoidOpen] = useState(false);
  const [creditOpen, setCreditOpen] = useState(false);
  const [payOpen, setPayOpen] = useState(false);
  const [confirmNow, setConfirmNow] = useState(true);

  async function post(action: string, body?: unknown, confirmText?: string) {
    if (confirmText && !window.confirm(confirmText)) return;
    setBusy(true);
    const res = await fetch(`/api/invoices/${invoice.id}/${action}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: body ? JSON.stringify(body) : undefined
    });
    const data = (await res.json().catch(() => ({}))) as { message?: string; code?: string; invoiceStatus?: string };
    setBusy(false);
    if (!res.ok) {
      push({ title: `${action} failed`, description: data.message, variant: "destructive" });
      return;
    }
    if (action === "credit-notes") {
      push({
        title: `Credit note ${data.code} issued`,
        description: data.invoiceStatus === "paid" ? "Invoice fully settled." : undefined,
        variant: "success"
      });
      setCreditOpen(false);
    } else {
      push({ title: `Invoice ${invoice.code} ${action === "issue" ? "issued" : "voided"}`, variant: "success" });
      setVoidOpen(false);
    }
    router.refresh();
  }

  async function handleRecordPayment(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!invoice.memberProfileId) return;
    const fd = new FormData(e.currentTarget);
    const amount = Number(fd.get("amount"));
    const method = String(fd.get("method"));
    setBusy(true);

    try {
      const res = await fetch("/api/payments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          memberProfileId: invoice.memberProfileId,
          method,
          amount,
          allocations: [{ invoiceId: invoice.id, amount }]
        })
      });
      const data = (await res.json().catch(() => ({}))) as { paymentId?: string; message?: string };
      if (!res.ok || !data.paymentId) {
        setBusy(false);
        push({ title: "Could not record payment", description: data.message, variant: "destructive" });
        return;
      }

      if (confirmNow) {
        const confRes = await fetch(`/api/payments/${data.paymentId}/confirm`, {
          method: "POST",
          headers: { "Content-Type": "application/json" }
        });
        const confData = (await confRes.json().catch(() => ({}))) as { receiptCode?: string; message?: string };
        setBusy(false);
        if (!confRes.ok) {
          push({ title: "Payment recorded (pending confirmation)", description: confData.message, variant: "default" });
        } else {
          push({
            title: `Payment confirmed · Receipt ${confData.receiptCode ?? ""}`,
            description: `Applied ${amount.toFixed(2)} to ${invoice.code}.`,
            variant: "success"
          });
        }
      } else {
        setBusy(false);
        push({
          title: "Payment recorded as pending",
          description: "Confirm it from the Payments page when money is verified.",
          variant: "success"
        });
      }
      setPayOpen(false);
      router.refresh();
    } catch {
      setBusy(false);
      push({ title: "Network error recording payment", variant: "destructive" });
    }
  }

  function openPdf() {
    window.open(`/api/invoices/${invoice.id}/pdf`, "_blank");
  }

  const canPay =
    Boolean(flags.canRecordPayment) &&
    invoice.amountDueMinor > 0 &&
    ["issued", "partial_paid", "overdue"].includes(invoice.status);

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button variant="outline" size="sm" onClick={openPdf}>
        PDF
      </Button>
      {canPay ? (
        <Button size="sm" disabled={busy} onClick={() => setPayOpen(true)}>
          Record payment
        </Button>
      ) : null}
      {flags.canIssue ? (
        <Button variant="success" size="sm" disabled={busy} onClick={() => post("issue", undefined, `Issue ${invoice.code}? The gapless number is allocated now.`)}>
          Issue invoice
        </Button>
      ) : null}
      {flags.canCredit ? (
        <Button variant="secondary" size="sm" disabled={busy} onClick={() => setCreditOpen(true)}>
          Credit note…
        </Button>
      ) : null}
      {flags.canVoid ? (
        <Button variant="destructive" size="sm" disabled={busy} onClick={() => setVoidOpen(true)}>
          Void…
        </Button>
      ) : null}

      <Dialog open={payOpen} onClose={() => setPayOpen(false)} title={`Record Payment for ${invoice.code}`} description={`Member: ${invoice.memberName ?? "—"} · Outstanding balance: ${(invoice.amountDueMinor / 100).toFixed(2)}`}>
        <form onSubmit={handleRecordPayment} className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="pay-method-inv">Payment Method</Label>
              <select
                id="pay-method-inv"
                name="method"
                defaultValue="cash"
                className="w-full rounded-md border bg-background px-3 py-2 text-sm shadow-sm"
              >
                {["cash", "bank_transfer", "qr", "card", "cheque"].map((m) => (
                  <option key={m} value={m}>
                    {m.replaceAll("_", " ")}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="pay-amount-inv">Amount to Pay</Label>
              <Input
                id="pay-amount-inv"
                name="amount"
                type="number"
                step="0.01"
                min="0.01"
                max={(invoice.amountDueMinor / 100).toFixed(2)}
                defaultValue={(invoice.amountDueMinor / 100).toFixed(2)}
                required
              />
            </div>
          </div>
          <div className="flex items-center gap-2 rounded-md bg-muted/50 p-2.5 text-xs">
            <input
              type="checkbox"
              id="pay-confirm-now"
              checked={confirmNow}
              onChange={(e) => setConfirmNow(e.target.checked)}
              className="h-4 w-4 rounded border-gray-300 text-primary"
            />
            <label htmlFor="pay-confirm-now" className="cursor-pointer text-muted-foreground">
              Confirm payment immediately & generate official receipt (cash in drawer / bank received)
            </label>
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setPayOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={busy}>
              {busy ? "Processing…" : confirmNow ? "Record & Confirm Payment" : "Record Pending Payment"}
            </Button>
          </div>
        </form>
      </Dialog>

      <Dialog open={voidOpen} onClose={() => setVoidOpen(false)} title="Void invoice" description="Requires Super Admin. The number stays consumed (no reuse); reason is mandatory and audited.">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const reason = String(new FormData(e.currentTarget).get("reason") ?? "");
            void post("void", { reason });
          }}
          className="space-y-4"
        >
          <div className="space-y-1.5">
            <Label htmlFor="inv-reason">Reason</Label>
            <Textarea id="inv-reason" name="reason" rows={3} required minLength={3} maxLength={500} />
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setVoidOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="destructive" disabled={busy}>
              {busy ? "Working…" : "Void invoice"}
            </Button>
          </div>
        </form>
      </Dialog>

      <Dialog open={creditOpen} onClose={() => setCreditOpen(false)} title="Issue credit note" description={`Outstanding due: ${(invoice.amountDueMinor / 100).toFixed(2)} — credits reduce the amount due without touching the issued document.`}>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const fd = new FormData(e.currentTarget);
            void post("credit-notes", { amount: Number(fd.get("amount")), reason: fd.get("reason") });
          }}
          className="space-y-4"
        >
          <div className="space-y-1.5">
            <Label htmlFor="cn-amount">Amount (major units, ≤ due)</Label>
            <Input
              id="cn-amount"
              name="amount"
              type="number"
              step="0.01"
              min="0.01"
              max={(invoice.amountDueMinor / 100).toFixed(2)}
              required
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="cn-reason">Reason</Label>
            <Textarea id="cn-reason" name="reason" rows={2} required minLength={3} maxLength={500} />
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setCreditOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="secondary" disabled={busy}>
              {busy ? "Working…" : "Issue credit note"}
            </Button>
          </div>
        </form>
      </Dialog>
    </div>
  );
}
