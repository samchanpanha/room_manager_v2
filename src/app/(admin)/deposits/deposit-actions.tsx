"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Input, Label, Select, Textarea } from "@/components/ui/input";
import { useToast } from "@/components/toast";

interface DepositRef {
  id: string;
  leaseId: string;
  leaseStatus: string;
  status: string;
  remainingMinor: number;
  requiredMinor?: number;
  collectedMinor?: number;
  invoiceId?: string | null;
  invoiceCode?: string | null;
  memberProfileId?: string;
  memberName?: string;
}

interface MemberDocOption {
  id: string;
  fileName: string;
  docType: { name: string };
}

const SETTLEMENT_OPEN = ["notice", "completed", "terminated"];

export function DepositActions({
  deposit,
  canUpdate,
  canRefund,
  canCollectPayment
}: {
  deposit: DepositRef;
  canUpdate: boolean;
  canRefund: boolean;
  canCollectPayment?: boolean;
}) {
  const router = useRouter();
  const { push } = useToast();
  const [busy, setBusy] = useState(false);
  const [deductOpen, setDeductOpen] = useState(false);
  const [refundOpen, setRefundOpen] = useState(false);
  const [collectOpen, setCollectOpen] = useState(false);
  const [confirmNow, setConfirmNow] = useState(true);
  const [availableDocs, setAvailableDocs] = useState<MemberDocOption[]>([]);
  const [selectedDocId, setSelectedDocId] = useState<string>("");
  const [customDocId, setCustomDocId] = useState<string>("");

  const settlementOpen = SETTLEMENT_OPEN.includes(deposit.leaseStatus) && deposit.status !== "settled" && deposit.remainingMinor > 0;
  const canCollect =
    Boolean(canCollectPayment) &&
    deposit.status === "billed" &&
    Boolean(deposit.invoiceId) &&
    (deposit.collectedMinor ?? 0) < (deposit.requiredMinor ?? 0);

  async function loadEvidenceDocs() {
    if (!deposit.memberProfileId) return;
    try {
      const res = await fetch(`/api/documents?entity=MEMBER&entityId=${encodeURIComponent(deposit.memberProfileId)}`);
      if (res.ok) {
        const data = (await res.json()) as { docs?: MemberDocOption[] };
        const docs = data.docs ?? [];
        setAvailableDocs(docs);
        if (docs.length > 0) {
          setSelectedDocId(docs[0].id);
        }
      }
    } catch {
      // ignore doc fetch failure, fall back to manual entry
    }
  }

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

  async function handleCollectDeposit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!deposit.memberProfileId || !deposit.invoiceId) return;
    const fd = new FormData(e.currentTarget);
    const amount = Number(fd.get("amount"));
    const method = String(fd.get("method"));
    setBusy(true);

    try {
      const res = await fetch("/api/payments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          memberProfileId: deposit.memberProfileId,
          method,
          amount,
          allocations: [{ invoiceId: deposit.invoiceId, amount }]
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
            title: `Deposit collected · Receipt ${confData.receiptCode ?? ""}`,
            description: `Deposit moved from billed to held (${amount.toFixed(2)}).`,
            variant: "success"
          });
        }
      } else {
        setBusy(false);
        push({
          title: "Payment recorded as pending",
          description: "Confirm it from the Payments page once money is in the drawer.",
          variant: "success"
        });
      }
      setCollectOpen(false);
      router.refresh();
    } catch {
      setBusy(false);
      push({ title: "Network error recording deposit payment", variant: "destructive" });
    }
  }

  const uncollected = Math.max(0, (deposit.requiredMinor ?? 0) - (deposit.collectedMinor ?? 0));

  return (
    <div className="flex items-center justify-end gap-1.5">
      {canCollect ? (
        <Button size="sm" onClick={() => setCollectOpen(true)}>
          Collect Deposit
        </Button>
      ) : null}

      {settlementOpen && canUpdate ? (
        <Button
          variant="destructive"
          size="sm"
          disabled={busy}
          onClick={() => {
            void loadEvidenceDocs();
            setDeductOpen(true);
          }}
        >
          Deduct…
        </Button>
      ) : null}

      {settlementOpen && canRefund ? (
        <Button variant="secondary" size="sm" disabled={busy} onClick={() => setRefundOpen(true)}>
          Refund…
        </Button>
      ) : null}

      {!settlementOpen && !canCollect ? (
        <span className="text-xs text-muted-foreground">
          {deposit.status === "settled" ? "settled" : deposit.status === "held" ? "held (opens at move-out)" : "—"}
        </span>
      ) : null}

      {/* Collect Deposit Modal */}
      <Dialog
        open={collectOpen}
        onClose={() => setCollectOpen(false)}
        title="Collect Security Deposit"
        description={`Member: ${deposit.memberName ?? "—"} · Deposit invoice: ${deposit.invoiceCode ?? "Billed"}`}
      >
        <form onSubmit={handleCollectDeposit} className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor={`col-method-${deposit.id}`}>Payment Method</Label>
              <select
                id={`col-method-${deposit.id}`}
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
              <Label htmlFor={`col-amount-${deposit.id}`}>Amount</Label>
              <Input
                id={`col-amount-${deposit.id}`}
                name="amount"
                type="number"
                step="0.01"
                min="0.01"
                max={(uncollected / 100).toFixed(2)}
                defaultValue={(uncollected / 100).toFixed(2)}
                required
              />
            </div>
          </div>
          <div className="flex items-center gap-2 rounded-md bg-muted/50 p-2.5 text-xs">
            <input
              type="checkbox"
              id={`col-confirm-${deposit.id}`}
              checked={confirmNow}
              onChange={(e) => setConfirmNow(e.target.checked)}
              className="h-4 w-4 rounded border-gray-300 text-primary"
            />
            <label htmlFor={`col-confirm-${deposit.id}`} className="cursor-pointer text-muted-foreground">
              Confirm payment immediately &amp; advance deposit status to &quot;Held&quot; (receipt generated)
            </label>
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setCollectOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={busy}>
              {busy ? "Processing…" : confirmNow ? "Collect & Confirm" : "Record Pending"}
            </Button>
          </div>
        </form>
      </Dialog>

      {/* Deduct Modal */}
      <Dialog
        open={deductOpen}
        onClose={() => setDeductOpen(false)}
        title="Deduct from Deposit (Move-out Settlement)"
        description={`Held: ${(deposit.remainingMinor / 100).toFixed(2)} — deductions require an evidence document and are posted to the ledger immediately.`}
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const fd = new FormData(e.currentTarget);
            const docId = selectedDocId === "custom" ? customDocId.trim() : (selectedDocId || customDocId.trim());
            if (!docId) {
              push({ title: "Evidence document is required", variant: "destructive" });
              return;
            }
            void act("deduct", {
              amount: Number(fd.get("amount")),
              reason: fd.get("reason"),
              evidenceDocId: docId,
              note: fd.get("note")
            });
          }}
          className="space-y-4"
        >
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor={`dd-amount-${deposit.id}`}>Deduction Amount</Label>
              <Input
                id={`dd-amount-${deposit.id}`}
                name="amount"
                type="number"
                step="0.01"
                min="0.01"
                max={(deposit.remainingMinor / 100).toFixed(2)}
                defaultValue={(deposit.remainingMinor / 100).toFixed(2)}
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
            <Label htmlFor={`dd-evidence-select-${deposit.id}`}>Evidence Document</Label>
            {availableDocs.length > 0 ? (
              <div className="space-y-2">
                <select
                  id={`dd-evidence-select-${deposit.id}`}
                  value={selectedDocId}
                  onChange={(e) => setSelectedDocId(e.target.value)}
                  className="w-full rounded-md border bg-background px-3 py-2 text-sm shadow-sm"
                >
                  {availableDocs.map((doc) => (
                    <option key={doc.id} value={doc.id}>
                      [{doc.docType?.name ?? "Document"}] {doc.fileName} ({doc.id.slice(0, 10)}…)
                    </option>
                  ))}
                  <option value="custom">Enter custom document registry ID…</option>
                </select>
                {selectedDocId === "custom" ? (
                  <Input
                    placeholder="Enter document registry ID (e.g. cuid)"
                    value={customDocId}
                    onChange={(e) => setCustomDocId(e.target.value)}
                    required
                  />
                ) : null}
              </div>
            ) : (
              <Input
                id={`dd-evidence-${deposit.id}`}
                placeholder="Enter document registry ID (photo or report ID)"
                value={customDocId}
                onChange={(e) => setCustomDocId(e.target.value)}
                required
              />
            )}
            <p className="text-[11px] text-muted-foreground">
              Required by policy. Evidence can be an uploaded move-out inspection photo or document.
            </p>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor={`dd-note-${deposit.id}`}>Itemized Note / Explanation</Label>
            <Textarea
              id={`dd-note-${deposit.id}`}
              name="note"
              rows={2}
              placeholder="E.g. Broken window latch repair + deep steam cleaning"
              required
              minLength={3}
              maxLength={500}
            />
          </div>

          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setDeductOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="destructive" disabled={busy}>
              {busy ? "Working…" : "Post Deduction"}
            </Button>
          </div>
        </form>
      </Dialog>

      {/* Refund Modal */}
      <Dialog
        open={refundOpen}
        onClose={() => setRefundOpen(false)}
        title="Refund Deposit Remainder"
        description={`Returns held ${(deposit.remainingMinor / 100).toFixed(2)} to member. Leave amount empty to refund full remainder and settle deposit.`}
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
                placeholder={(deposit.remainingMinor / 100).toFixed(2)}
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
            <Textarea
              id={`dr-note-${deposit.id}`}
              name="note"
              rows={2}
              defaultValue="Move-out deposit settlement refund"
              required
              minLength={3}
              maxLength={500}
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setRefundOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="secondary" disabled={busy}>
              {busy ? "Working…" : "Post Refund"}
            </Button>
          </div>
        </form>
      </Dialog>
    </div>
  );
}
