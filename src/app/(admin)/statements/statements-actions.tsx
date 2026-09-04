"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Input, Label, Select } from "@/components/ui/input";
import { useToast } from "@/components/toast";

async function post(url: string, body: unknown): Promise<{ ok: boolean; message?: string }> {
  const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const data = (await res.json().catch(() => ({}))) as { message?: string; code?: string };
  return { ok: res.ok, message: data.message ?? data.code };
}

interface Props {
  canManage: boolean;
  drafts: { id: string; label: string }[];
  approved: { id: string; label: string }[];
}

export function StatementsActions({ canManage, drafts, approved }: Props) {
  const router = useRouter();
  const { push } = useToast();
  const [busy, setBusy] = useState(false);

  async function run(url: string, body: unknown, okTitle: string) {
    setBusy(true);
    const r = await post(url, body);
    setBusy(false);
    if (!r.ok) {
      push({ title: "Failed", description: r.message, variant: "destructive" });
      return;
    }
    push({ title: okTitle, variant: "success" });
    router.refresh();
  }

  if (!canManage) return null;
  return (
    <div className="mb-4 flex flex-wrap gap-2">
      <GenerateDialog busy={busy} onDone={(b) => run("/api/statements/generate", b, "Statements generated")} />
      <ApproveDialog busy={busy} drafts={drafts} onDone={(id) => run(`/api/statements/${id}/approve`, {}, "Statement approved + accrued")} />
      <AdjustDialog busy={busy} drafts={drafts} onDone={(id, b) => run(`/api/statements/${id}/adjust`, b, "Adjustment recorded")} />
      <PayDialog busy={busy} approved={approved} onDone={(id, b) => run(`/api/statements/${id}/pay`, b, "Payout posted")} />
    </div>
  );
}

function GenerateDialog({ busy, onDone }: { busy: boolean; onDone: (b: Record<string, unknown>) => Promise<void> }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button size="sm" onClick={() => setOpen(true)}>
        Generate…
      </Button>
      <Dialog open={open} onClose={() => setOpen(false)} title="Generate owner statements" description="One per active contract for the month (idempotent). Contracts not yet at their payout day are skipped unless forced.">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const fd = new FormData(e.currentTarget);
            const month = String(fd.get("month") ?? "");
            void onDone({ ...(month ? { month } : {}), force: fd.get("force") === "on" }).then(() => setOpen(false));
          }}
          className="space-y-4"
        >
          <div className="space-y-1.5">
            <Label htmlFor="stm-month">Month (blank = previous month)</Label>
            <Input id="stm-month" name="month" type="month" />
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="force" className="h-4 w-4" />
            Force (ignore the contract payout day)
          </label>
          <Button type="submit" disabled={busy}>
            Generate
          </Button>
        </form>
      </Dialog>
    </>
  );
}

function ApproveDialog({ busy, drafts, onDone }: { busy: boolean; drafts: { id: string; label: string }[]; onDone: (id: string) => Promise<void> }) {
  const [open, setOpen] = useState(false);
  const [id, setId] = useState(drafts[0]?.id ?? "");
  return (
    <>
      <Button size="sm" variant="success" disabled={drafts.length === 0} onClick={() => setOpen(true)}>
        Approve…
      </Button>
      <Dialog open={open} onClose={() => setOpen(false)} title="Approve statement" description="Posts the accrual DR 3900 Owner Distributions / CR 2200 Owner Payable and files the PDF.">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void onDone(id).then(() => setOpen(false));
          }}
          className="space-y-4"
        >
          <div className="space-y-1.5">
            <Label htmlFor="stma-st">Draft statement</Label>
            <Select id="stma-st" value={id} onChange={(e) => setId(e.target.value)} required>
              {drafts.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.label}
                </option>
              ))}
            </Select>
          </div>
          <Button type="submit" disabled={busy}>
            Approve + accrue
          </Button>
        </form>
      </Dialog>
    </>
  );
}

function AdjustDialog({ busy, drafts, onDone }: { busy: boolean; drafts: { id: string; label: string }[]; onDone: (id: string, b: Record<string, unknown>) => Promise<void> }) {
  const [open, setOpen] = useState(false);
  const [id, setId] = useState(drafts[0]?.id ?? "");
  return (
    <>
      <Button size="sm" variant="outline" disabled={drafts.length === 0} onClick={() => setOpen(true)}>
        Adjust…
      </Button>
      <Dialog open={open} onClose={() => setOpen(false)} title="Adjust a draft statement" description="§M24 ± adjustments — negative amounts reduce the payout. The reason is mandatory and audited.">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const fd = new FormData(e.currentTarget);
            void onDone(id, { adjustments: Number(fd.get("adjustments")), reason: String(fd.get("reason")) }).then(() => setOpen(false));
          }}
          className="space-y-4"
        >
          <div className="space-y-1.5">
            <Label htmlFor="stmj-st">Draft statement</Label>
            <Select id="stmj-st" value={id} onChange={(e) => setId(e.target.value)} required>
              {drafts.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.label}
                </option>
              ))}
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="stmj-amount">Adjustment (± dollars)</Label>
            <Input id="stmj-amount" name="adjustments" type="number" step="0.01" required />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="stmj-reason">Reason</Label>
            <Input id="stmj-reason" name="reason" minLength={3} required placeholder="utility reimbursement correction" />
          </div>
          <Button type="submit" disabled={busy}>
            Apply adjustment
          </Button>
        </form>
      </Dialog>
    </>
  );
}

function PayDialog({ busy, approved, onDone }: { busy: boolean; approved: { id: string; label: string }[]; onDone: (id: string, b: Record<string, unknown>) => Promise<void> }) {
  const [open, setOpen] = useState(false);
  const [id, setId] = useState(approved[0]?.id ?? "");
  return (
    <>
      <Button size="sm" variant="destructive" disabled={approved.length === 0} onClick={() => setOpen(true)}>
        Pay payout…
      </Button>
      <Dialog open={open} onClose={() => setOpen(false)} title="Pay owner payout" description="Posts DR 2200 Owner Payable / CR cash|bank — Owner Payable returns to its pre-accrual balance.">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const fd = new FormData(e.currentTarget);
            void onDone(id, { method: String(fd.get("method")) }).then(() => setOpen(false));
          }}
          className="space-y-4"
        >
          <div className="space-y-1.5">
            <Label htmlFor="stmp-st">Approved statement</Label>
            <Select id="stmp-st" value={id} onChange={(e) => setId(e.target.value)} required>
              {approved.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.label}
                </option>
              ))}
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="stmp-method">Method</Label>
            <Select id="stmp-method" name="method" defaultValue="bank_transfer">
              <option value="bank_transfer">Bank transfer</option>
              <option value="cash">Cash</option>
            </Select>
          </div>
          <Button type="submit" disabled={busy}>
            Post payout
          </Button>
        </form>
      </Dialog>
    </>
  );
}
