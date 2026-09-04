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
  canRecord: boolean;
  canApprove: boolean;
  properties: { id: string; label: string }[];
  categories: { id: string; label: string }[];
  month: string;
  pending: { id: string; label: string }[];
  approved: { id: string; label: string }[];
  recurring: { id: string; label: string }[];
}

export function ExpensesActions({ canRecord, canApprove, properties, categories, month, pending, approved, recurring }: Props) {
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

  return (
    <div className="mb-4 flex flex-wrap gap-2">
      {canRecord ? <NewExpense busy={busy} properties={properties} categories={categories} onDone={(b) => run("/api/expenses", b, "Expense recorded")} /> : null}
      {canApprove ? (
        <>
          <ApproveDialog busy={busy} pending={pending} onDone={(b) => run(`/api/expenses/${b.id}/approve`, {}, "Expense approved + posted")} />
          <RejectDialog busy={busy} pending={pending} onDone={(id, b) => run(`/api/expenses/${id}/reject`, b, "Expense rejected")} />
          <VoidDialog busy={busy} approved={approved} onDone={(id, b) => run(`/api/expenses/${id}/void`, b, "Expense voided (ledger reversed)")} />
          <NewCategory busy={busy} properties={properties} onDone={(b) => run("/api/expenses/categories", b, "Category created")} />
          <BudgetDialog busy={busy} categories={categories} month={month} onDone={(b) => run("/api/expenses/budgets", b, "Budget saved")} />
          <RecurringDialog busy={busy} properties={properties} categories={categories} onDone={(b) => run("/api/expenses/recurring", b, "Recurring template created")} />
          {recurring.length > 0 ? <RunRecurring busy={busy} recurring={recurring} onDone={(id) => run(`/api/expenses/recurring/${id}/run`, {}, "Recurring expense materialized")} /> : null}
        </>
      ) : null}
    </div>
  );
}

function NewExpense({ busy, properties, categories, onDone }: { busy: boolean; properties: { id: string; label: string }[]; categories: { id: string; label: string }[]; onDone: (b: Record<string, unknown>) => Promise<void> }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button size="sm" onClick={() => setOpen(true)}>
        Record expense…
      </Button>
      <Dialog open={open} onClose={() => setOpen(false)} title="Record expense" description="Above the approval threshold it stays pending for an Accountant; below it auto-approves and posts to the ledger.">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const fd = new FormData(e.currentTarget);
            void onDone({
              propertyId: String(fd.get("propertyId")),
              categoryId: String(fd.get("categoryId")),
              vendorName: String(fd.get("vendorName")),
              description: String(fd.get("description") ?? "") || undefined,
              expenseDate: String(fd.get("expenseDate")),
              amount: Number(fd.get("amount")),
              paidVia: String(fd.get("paidVia")),
              receiptDocId: String(fd.get("receiptDocId") ?? "") || undefined
            }).then(() => setOpen(false));
          }}
          className="space-y-4"
        >
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="ex-prop">Property</Label>
              <Select id="ex-prop" name="propertyId" defaultValue={properties[0]?.id} required>
                {properties.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.label}
                  </option>
                ))}
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ex-cat">Category</Label>
              <Select id="ex-cat" name="categoryId" defaultValue={categories[0]?.id} required>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.label}
                  </option>
                ))}
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ex-vendor">Vendor</Label>
              <Input id="ex-vendor" name="vendorName" minLength={2} required />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ex-amount">Amount</Label>
              <Input id="ex-amount" name="amount" type="number" step="0.01" min="0.01" required />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ex-date">Date</Label>
              <Input id="ex-date" name="expenseDate" type="date" required />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ex-via">Paid via</Label>
              <Select id="ex-via" name="paidVia" defaultValue="cash">
                <option value="cash">Cash</option>
                <option value="bank_transfer">Bank transfer</option>
              </Select>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ex-desc">Description</Label>
            <Input id="ex-desc" name="description" placeholder="monthly internet bill" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ex-receipt">Receipt doc ID (uploaded to Documents, entity EXPENSE)</Label>
            <Input id="ex-receipt" name="receiptDocId" placeholder="optional" />
          </div>
          <Button type="submit" disabled={busy}>
            Record
          </Button>
        </form>
      </Dialog>
    </>
  );
}

function ApproveDialog({ busy, pending, onDone }: { busy: boolean; pending: { id: string; label: string }[]; onDone: (b: { id: string }) => Promise<void> }) {
  const [open, setOpen] = useState(false);
  const [id, setId] = useState(pending[0]?.id ?? "");
  return (
    <>
      <Button size="sm" variant="success" disabled={pending.length === 0} onClick={() => setOpen(true)}>
        Approve…
      </Button>
      <Dialog open={open} onClose={() => setOpen(false)} title="Approve expense" description="Posts DR category-account / CR cash|bank to the ledger.">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void onDone({ id }).then(() => setOpen(false));
          }}
          className="space-y-4"
        >
          <div className="space-y-1.5">
            <Label htmlFor="exap-exp">Pending expense</Label>
            <Select id="exap-exp" value={id} onChange={(e) => setId(e.target.value)} required>
              {pending.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.label}
                </option>
              ))}
            </Select>
          </div>
          <Button type="submit" disabled={busy}>
            Approve + post
          </Button>
        </form>
      </Dialog>
    </>
  );
}

function RejectDialog({ busy, pending, onDone }: { busy: boolean; pending: { id: string; label: string }[]; onDone: (id: string, b: Record<string, unknown>) => Promise<void> }) {
  const [open, setOpen] = useState(false);
  const [id, setId] = useState(pending[0]?.id ?? "");
  return (
    <>
      <Button size="sm" variant="destructive" disabled={pending.length === 0} onClick={() => setOpen(true)}>
        Reject…
      </Button>
      <Dialog open={open} onClose={() => setOpen(false)} title="Reject expense" description="Rejected expenses never touch the ledger.">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const fd = new FormData(e.currentTarget);
            void onDone(id, { reason: String(fd.get("reason")) }).then(() => setOpen(false));
          }}
          className="space-y-4"
        >
          <div className="space-y-1.5">
            <Label htmlFor="exre-exp">Pending expense</Label>
            <Select id="exre-exp" value={id} onChange={(e) => setId(e.target.value)} required>
              {pending.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.label}
                </option>
              ))}
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="exre-reason">Reason</Label>
            <Input id="exre-reason" name="reason" minLength={3} required />
          </div>
          <Button type="submit" disabled={busy}>
            Reject
          </Button>
        </form>
      </Dialog>
    </>
  );
}

function VoidDialog({ busy, approved, onDone }: { busy: boolean; approved: { id: string; label: string }[]; onDone: (id: string, b: Record<string, unknown>) => Promise<void> }) {
  const [open, setOpen] = useState(false);
  const [id, setId] = useState(approved[0]?.id ?? "");
  return (
    <>
      <Button size="sm" variant="outline" disabled={approved.length === 0} onClick={() => setOpen(true)}>
        Void…
      </Button>
      <Dialog open={open} onClose={() => setOpen(false)} title="Void approved expense" description="Reverses the ledger posting — nothing is deleted (append-only ledger).">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const fd = new FormData(e.currentTarget);
            void onDone(id, { reason: String(fd.get("reason")) }).then(() => setOpen(false));
          }}
          className="space-y-4"
        >
          <div className="space-y-1.5">
            <Label htmlFor="exvo-exp">Approved expense</Label>
            <Select id="exvo-exp" value={id} onChange={(e) => setId(e.target.value)} required>
              {approved.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.label}
                </option>
              ))}
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="exvo-reason">Reason</Label>
            <Input id="exvo-reason" name="reason" minLength={3} required />
          </div>
          <Button type="submit" disabled={busy}>
            Void + reverse
          </Button>
        </form>
      </Dialog>
    </>
  );
}

function NewCategory({ busy, properties, onDone }: { busy: boolean; properties: { id: string; label: string }[]; onDone: (b: Record<string, unknown>) => Promise<void> }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button size="sm" variant="outline" onClick={() => setOpen(true)}>
        New category…
      </Button>
      <Dialog open={open} onClose={() => setOpen(false)} title="New expense category" description="Maps to a ledger expense account (5000 Operating / 5100 Bank fees).">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const fd = new FormData(e.currentTarget);
            void onDone({ propertyId: String(fd.get("propertyId")), name: String(fd.get("name")), accountCode: String(fd.get("accountCode")) }).then(() => setOpen(false));
          }}
          className="space-y-4"
        >
          <div className="space-y-1.5">
            <Label htmlFor="exc-prop">Property</Label>
            <Select id="exc-prop" name="propertyId" defaultValue={properties[0]?.id} required>
              {properties.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.label}
                </option>
              ))}
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="exc-name">Name</Label>
            <Input id="exc-name" name="name" minLength={2} required />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="exc-acc">Ledger account</Label>
            <Select id="exc-acc" name="accountCode" defaultValue="5000">
              <option value="5000">5000 · Operating expenses</option>
              <option value="5100">5100 · Bank fees</option>
            </Select>
          </div>
          <Button type="submit" disabled={busy}>
            Create
          </Button>
        </form>
      </Dialog>
    </>
  );
}

function BudgetDialog({ busy, categories, month, onDone }: { busy: boolean; categories: { id: string; label: string }[]; month: string; onDone: (b: Record<string, unknown>) => Promise<void> }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button size="sm" variant="outline" disabled={categories.length === 0} onClick={() => setOpen(true)}>
        Set budget…
      </Button>
      <Dialog open={open} onClose={() => setOpen(false)} title="Monthly budget" description="Per category and month — variance shows on the P&L.">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const fd = new FormData(e.currentTarget);
            void onDone({ categoryId: String(fd.get("categoryId")), month: String(fd.get("month")), amount: Number(fd.get("amount")) }).then(() => setOpen(false));
          }}
          className="space-y-4"
        >
          <div className="space-y-1.5">
            <Label htmlFor="exb-cat">Category</Label>
            <Select id="exb-cat" name="categoryId" defaultValue={categories[0]?.id} required>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.label}
                </option>
              ))}
            </Select>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="exb-month">Month</Label>
              <Input id="exb-month" name="month" type="month" defaultValue={month} required />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="exb-amount">Budget amount</Label>
              <Input id="exb-amount" name="amount" type="number" step="0.01" min="0" required />
            </div>
          </div>
          <Button type="submit" disabled={busy}>
            Save budget
          </Button>
        </form>
      </Dialog>
    </>
  );
}

function RecurringDialog({ busy, properties, categories, onDone }: { busy: boolean; properties: { id: string; label: string }[]; categories: { id: string; label: string }[]; onDone: (b: Record<string, unknown>) => Promise<void> }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button size="sm" variant="outline" onClick={() => setOpen(true)}>
        New recurring…
      </Button>
      <Dialog open={open} onClose={() => setOpen(false)} title="Recurring expense template" description="Materializes one expense per month on/after the run day (same approval rules).">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const fd = new FormData(e.currentTarget);
            void onDone({
              propertyId: String(fd.get("propertyId")),
              categoryId: String(fd.get("categoryId")),
              vendorName: String(fd.get("vendorName")),
              description: String(fd.get("description") ?? "") || undefined,
              amount: Number(fd.get("amount")),
              paidVia: String(fd.get("paidVia")),
              dayOfMonth: Number(fd.get("dayOfMonth"))
            }).then(() => setOpen(false));
          }}
          className="space-y-4"
        >
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="exr-prop">Property</Label>
              <Select id="exr-prop" name="propertyId" defaultValue={properties[0]?.id} required>
                {properties.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.label}
                  </option>
                ))}
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="exr-cat">Category</Label>
              <Select id="exr-cat" name="categoryId" defaultValue={categories[0]?.id} required>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.label}
                  </option>
                ))}
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="exr-vendor">Vendor</Label>
              <Input id="exr-vendor" name="vendorName" minLength={2} required />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="exr-amount">Amount</Label>
              <Input id="exr-amount" name="amount" type="number" step="0.01" min="0.01" required />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="exr-via">Paid via</Label>
              <Select id="exr-via" name="paidVia" defaultValue="bank_transfer">
                <option value="cash">Cash</option>
                <option value="bank_transfer">Bank transfer</option>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="exr-day">Run day (1–28)</Label>
              <Input id="exr-day" name="dayOfMonth" type="number" min="1" max="28" defaultValue="1" required />
            </div>
          </div>
          <Button type="submit" disabled={busy}>
            Create template
          </Button>
        </form>
      </Dialog>
    </>
  );
}

function RunRecurring({ busy, recurring, onDone }: { busy: boolean; recurring: { id: string; label: string }[]; onDone: (id: string) => Promise<void> }) {
  const [open, setOpen] = useState(false);
  const [id, setId] = useState(recurring[0]?.id ?? "");
  return (
    <>
      <Button size="sm" variant="outline" onClick={() => setOpen(true)}>
        Run recurring…
      </Button>
      <Dialog open={open} onClose={() => setOpen(false)} title="Run recurring template" description="Creates this month's expense (idempotent — a template runs once per month).">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void onDone(id).then(() => setOpen(false));
          }}
          className="space-y-4"
        >
          <div className="space-y-1.5">
            <Label htmlFor="exrr-rec">Template</Label>
            <Select id="exrr-rec" value={id} onChange={(e) => setId(e.target.value)} required>
              {recurring.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.label}
                </option>
              ))}
            </Select>
          </div>
          <Button type="submit" disabled={busy}>
            Run now
          </Button>
        </form>
      </Dialog>
    </>
  );
}
