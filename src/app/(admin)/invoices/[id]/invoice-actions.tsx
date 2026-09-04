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
  invoice: { id: string; code: string; status: string; amountDueMinor: number };
  flags: { canIssue: boolean; canVoid: boolean; canCredit: boolean };
}) {
  const router = useRouter();
  const { push } = useToast();
  const [busy, setBusy] = useState(false);
  const [voidOpen, setVoidOpen] = useState(false);
  const [creditOpen, setCreditOpen] = useState(false);

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

  function openPdf() {
    window.open(`/api/invoices/${invoice.id}/pdf`, "_blank");
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button variant="outline" size="sm" onClick={openPdf}>
        PDF
      </Button>
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
