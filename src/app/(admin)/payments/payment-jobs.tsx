"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Input, Label, Textarea } from "@/components/ui/input";
import { useToast } from "@/components/toast";

interface MemberOption {
  id: string;
  name: string;
}

interface OpenInvoiceOption {
  id: string;
  code: string;
  amountDueMinor: number;
  isDeposit: boolean;
  dueDate: string | null;
}

export function RecordPaymentButton({
  canCreate,
  initialMembers = []
}: {
  canCreate: boolean;
  initialMembers?: MemberOption[];
}) {
  const router = useRouter();
  const { push } = useToast();
  const [open, setOpen] = useState(false);
  const [members, setMembers] = useState<MemberOption[]>(initialMembers);
  const [loadingMembers, setLoadingMembers] = useState(false);
  const [selectedMemberId, setSelectedMemberId] = useState<string>(initialMembers[0]?.id ?? "");
  const [openInvoices, setOpenInvoices] = useState<OpenInvoiceOption[]>([]);
  const [targetInvoiceId, setTargetInvoiceId] = useState<string>("");
  const [amountVal, setAmountVal] = useState<string>("");
  const [confirmNow, setConfirmNow] = useState(true);
  const [busy, setBusy] = useState(false);

  async function loadInvoicesForMember(mId: string) {
    if (!mId) {
      setOpenInvoices([]);
      return;
    }
    const res = await fetch(`/api/invoices?memberProfileId=${encodeURIComponent(mId)}`);
    if (res.ok) {
      const data = (await res.json()) as { invoices?: Array<{ id: string; code: string; status: string; amountDueMinor: number; isDeposit: boolean; dueDate: string | null }> };
      const openOnly = (data.invoices ?? []).filter((i) => ["issued", "partial_paid", "overdue"].includes(i.status) && i.amountDueMinor > 0);
      setOpenInvoices(openOnly);
    }
  }

  async function loadMembers() {
    setLoadingMembers(true);
    try {
      const res = await fetch("/api/members");
      if (!res.ok) {
        push({ title: "Could not load members", variant: "destructive" });
        return;
      }
      const data = (await res.json()) as {
        members?: Array<{
          id: string;
          party: { name: string; phone?: string | null };
          leases?: Array<{ room?: { number: string } | null }>;
        }>;
      } | Array<{ id: string; party: { name: string; phone?: string | null }; leases?: Array<{ room?: { number: string } | null }> }>;
      const list = Array.isArray(data) ? data : data.members ?? [];
      const mapped = list.map((m) => {
        const room = m.leases?.[0]?.room?.number;
        const phone = m.party?.phone;
        const label = `${m.party?.name ?? "Unknown"}${room ? ` (Room ${room})` : ""}${phone ? ` · ${phone}` : ""}`;
        return { id: m.id, name: label };
      });
      setMembers(mapped);
      if (mapped.length > 0) {
        setSelectedMemberId((prev) => prev || mapped[0]!.id);
        void loadInvoicesForMember(selectedMemberId || mapped[0]!.id);
      }
    } finally {
      setLoadingMembers(false);
    }
  }

  function handleMemberChange(mId: string) {
    setSelectedMemberId(mId);
    setTargetInvoiceId("");
    setAmountVal("");
    void loadInvoicesForMember(mId);
  }

  function handleInvoiceChange(invId: string) {
    setTargetInvoiceId(invId);
    if (invId) {
      const found = openInvoices.find((i) => i.id === invId);
      if (found) {
        setAmountVal((found.amountDueMinor / 100).toFixed(2));
      }
    }
  }

  async function create(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const amount = Number(fd.get("amount"));
    const method = String(fd.get("method"));
    setBusy(true);

    const body: {
      memberProfileId: string;
      method: string;
      amount: number;
      allocations?: Array<{ invoiceId: string; amount: number }>;
    } = {
      memberProfileId: selectedMemberId,
      method,
      amount
    };

    if (targetInvoiceId) {
      body.allocations = [{ invoiceId: targetInvoiceId, amount }];
    }

    try {
      const res = await fetch("/api/payments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body)
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
            description: `Successfully allocated ${(amount).toFixed(2)}.`,
            variant: "success"
          });
        }
      } else {
        setBusy(false);
        push({ title: "Payment recorded as pending", description: "Confirm it once the money is in the drawer/bank.", variant: "success" });
      }
      setOpen(false);
      router.refresh();
    } catch {
      setBusy(false);
      push({ title: "Error submitting payment", variant: "destructive" });
    }
  }

  if (!canCreate) return null;
  return (
    <>
      <Button
        onClick={() => {
          if (members.length === 0) {
            void loadMembers();
          } else if (selectedMemberId && openInvoices.length === 0) {
            void loadInvoicesForMember(selectedMemberId);
          }
          setOpen(true);
        }}
      >
        Record payment
      </Button>
      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title="Record payment"
        description="Receive money from a member and allocate it to open invoices (oldest-first or specific invoice)."
      >
        <form onSubmit={create} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="pay-member">Member</Label>
            <select
              id="pay-member"
              name="memberProfileId"
              value={selectedMemberId}
              onChange={(e) => handleMemberChange(e.target.value)}
              required
              disabled={loadingMembers}
              className="w-full rounded-md border bg-background px-3 py-2 text-sm shadow-sm"
            >
              {loadingMembers ? (
                <option value="">Loading members...</option>
              ) : members.length === 0 ? (
                <option value="">No members found</option>
              ) : (
                members.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                  </option>
                ))
              )}
            </select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="pay-target-inv">Target Invoice (Optional)</Label>
            <select
              id="pay-target-inv"
              value={targetInvoiceId}
              onChange={(e) => handleInvoiceChange(e.target.value)}
              className="w-full rounded-md border bg-background px-3 py-2 text-sm shadow-sm"
            >
              <option value="">Auto-allocate (oldest-first across all open invoices)</option>
              {openInvoices.map((inv) => (
                <option key={inv.id} value={inv.id}>
                  {inv.code} · Due: ${(inv.amountDueMinor / 100).toFixed(2)} {inv.isDeposit ? "(Security Deposit)" : "(Rent/Service)"}
                </option>
              ))}
            </select>
            {openInvoices.length > 0 && !targetInvoiceId ? (
              <p className="text-[11px] text-muted-foreground">
                {openInvoices.length} open invoice(s) found for this member totaling $
                {(openInvoices.reduce((s, i) => s + i.amountDueMinor, 0) / 100).toFixed(2)}.
              </p>
            ) : null}
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="pay-method">Method</Label>
              <select
                id="pay-method"
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
              <div className="flex items-center justify-between gap-2">
                <Label htmlFor="pay-amount">Amount</Label>
                {openInvoices.reduce((s, i) => s + i.amountDueMinor, 0) > 0 ? (
                  <button
                    type="button"
                    onClick={() => {
                      setTargetInvoiceId("");
                      setAmountVal((openInvoices.reduce((s, i) => s + i.amountDueMinor, 0) / 100).toFixed(2));
                    }}
                    className="text-[11px] font-medium text-primary hover:underline"
                  >
                    Pay all outstanding — $
                    {(openInvoices.reduce((s, i) => s + i.amountDueMinor, 0) / 100).toFixed(2)} (oldest-first)
                  </button>
                ) : null}
              </div>
              <Input
                id="pay-amount"
                name="amount"
                type="number"
                step="0.01"
                min="0.01"
                value={amountVal}
                onChange={(e) => setAmountVal(e.target.value)}
                placeholder="0.00"
                required
              />
              {!targetInvoiceId && openInvoices.reduce((s, i) => s + i.amountDueMinor, 0) > 0 ? (
                <p className="text-[11px] text-muted-foreground">
                  With no target invoice the full amount auto-allocates oldest-first across all {openInvoices.length} open invoice(s).
                </p>
              ) : null}
            </div>
          </div>

          <div className="flex items-center gap-2 rounded-md bg-muted/50 p-2.5 text-xs">
            <input
              type="checkbox"
              id="pay-confirm-direct"
              checked={confirmNow}
              onChange={(e) => setConfirmNow(e.target.checked)}
              className="h-4 w-4 rounded border-gray-300 text-primary"
            />
            <label htmlFor="pay-confirm-direct" className="cursor-pointer text-muted-foreground">
              Confirm payment immediately & generate official receipt (cash in drawer / bank received)
            </label>
          </div>

          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={busy}>
              {busy ? "Saving…" : confirmNow ? "Record & Confirm Payment" : "Record Pending Payment"}
            </Button>
          </div>
        </form>
      </Dialog>
    </>
  );
}

export function PaymentActions({
  paymentId,
  status,
  remainingMinor,
  canUpdate,
  canRefund
}: {
  paymentId: string;
  status: string;
  remainingMinor: number;
  canUpdate: boolean;
  canRefund: boolean;
}) {
  const router = useRouter();
  const { push } = useToast();
  const [busy, setBusy] = useState(false);
  const [failOpen, setFailOpen] = useState(false);
  const [refundOpen, setRefundOpen] = useState(false);

  async function act(action: "confirm" | "fail" | "refund", body?: unknown) {
    setBusy(true);
    const res = await fetch(`/api/payments/${paymentId}/${action}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: body ? JSON.stringify(body) : undefined
    });
    const data = (await res.json().catch(() => ({}))) as { message?: string; ignored?: boolean; receiptCode?: string | null };
    setBusy(false);
    if (!res.ok) {
      push({ title: `${action} failed`, description: data.message, variant: "destructive" });
      return;
    }
    push({
      title: data.ignored
        ? "Already confirmed — duplicate ignored"
        : action === "confirm"
          ? `Confirmed · receipt ${data.receiptCode}`
          : action === "fail"
            ? "Payment marked failed"
            : "Member credit refunded",
      variant: "success"
    });
    setFailOpen(false);
    setRefundOpen(false);
    router.refresh();
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {status === "pending" && canUpdate ? (
        <>
          <Button variant="success" size="sm" disabled={busy} onClick={() => act("confirm")}>
            Confirm
          </Button>
          <Button variant="destructive" size="sm" disabled={busy} onClick={() => setFailOpen(true)}>
            Fail…
          </Button>
        </>
      ) : null}
      {status === "confirmed" && remainingMinor > 0 && canRefund ? (
        <Button variant="secondary" size="sm" disabled={busy} onClick={() => setRefundOpen(true)}>
          Refund credit…
        </Button>
      ) : null}
      {status === "confirmed" ? (
        <Button variant="outline" size="sm" onClick={() => window.open(`/api/payments/${paymentId}/receipt`, "_blank")}>
          Receipt PDF
        </Button>
      ) : null}

      <Dialog open={failOpen} onClose={() => setFailOpen(false)} title="Fail payment" description="Marks the pending payment failed (e.g. bounced cheque).">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const reason = String(new FormData(e.currentTarget).get("reason") ?? "");
            void act("fail", { reason });
          }}
          className="space-y-4"
        >
          <div className="space-y-1.5">
            <Label htmlFor={`pay-fail-${paymentId}`}>Reason</Label>
            <Textarea id={`pay-fail-${paymentId}`} name="reason" rows={2} required minLength={3} maxLength={500} />
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setFailOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="destructive" disabled={busy}>
              Mark failed
            </Button>
          </div>
        </form>
      </Dialog>

      <Dialog open={refundOpen} onClose={() => setRefundOpen(false)} title="Refund member credit" description={`Returns the unallocated ${(remainingMinor / 100).toFixed(2)} to the member. Accountant approval required; posts a refund entry to the ledger.`}>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const reason = String(new FormData(e.currentTarget).get("reason") ?? "");
            void act("refund", { reason });
          }}
          className="space-y-4"
        >
          <div className="space-y-1.5">
            <Label htmlFor={`pay-refund-${paymentId}`}>Reason</Label>
            <Textarea id={`pay-refund-${paymentId}`} name="reason" rows={2} required minLength={3} maxLength={500} />
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setRefundOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="secondary" disabled={busy}>
              Refund
            </Button>
          </div>
        </form>
      </Dialog>
    </div>
  );
}
