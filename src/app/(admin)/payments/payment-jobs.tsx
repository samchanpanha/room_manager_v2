"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Input, Label, Select, Textarea } from "@/components/ui/input";
import { useToast } from "@/components/toast";

interface MemberOption {
  id: string;
  name: string;
}

export function RecordPaymentButton({ canCreate }: { canCreate: boolean }) {
  const router = useRouter();
  const { push } = useToast();
  const [open, setOpen] = useState(false);
  const [members, setMembers] = useState<MemberOption[]>([]);
  const [busy, setBusy] = useState(false);

  async function loadMembers() {
    const res = await fetch("/api/members");
    if (!res.ok) {
      push({ title: "Could not load members", variant: "destructive" });
      return;
    }
    const data = (await res.json()) as { members?: Array<{ id: string; party: { name: string } }> } | Array<{ id: string; party: { name: string } }>;
    const list = Array.isArray(data) ? data : data.members ?? [];
    setMembers(list.map((m) => ({ id: m.id, name: m.party.name })));
  }

  async function create(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    setBusy(true);
    const res = await fetch("/api/payments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        memberProfileId: fd.get("memberProfileId"),
        method: fd.get("method"),
        amount: Number(fd.get("amount"))
      })
    });
    const data = (await res.json().catch(() => ({}))) as { message?: string };
    setBusy(false);
    if (!res.ok) {
      push({ title: "Could not record payment", description: data.message, variant: "destructive" });
      return;
    }
    push({ title: "Payment recorded", description: "Confirm it once the money is in the drawer/bank.", variant: "success" });
    setOpen(false);
    router.refresh();
  }

  if (!canCreate) return null;
  return (
    <>
      <Button
        onClick={() => {
          void loadMembers();
          setOpen(true);
        }}
      >
        Record payment
      </Button>
      <Dialog open={open} onClose={() => setOpen(false)} title="Record payment" description="Creates a pending payment; allocations run oldest-first across the member's open invoices at confirmation.">
        <form onSubmit={create} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="pay-member">Member</Label>
            <Select id="pay-member" name="memberProfileId" required>
              {members.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </Select>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="pay-method">Method</Label>
              <Select id="pay-method" name="method" defaultValue="cash">
                {["cash", "bank_transfer", "qr", "card", "cheque"].map((m) => (
                  <option key={m} value={m}>
                    {m.replaceAll("_", " ")}
                  </option>
                ))}
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="pay-amount">Amount</Label>
              <Input id="pay-amount" name="amount" type="number" step="0.01" min="0.01" required />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={busy}>
              {busy ? "Saving…" : "Record payment"}
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
