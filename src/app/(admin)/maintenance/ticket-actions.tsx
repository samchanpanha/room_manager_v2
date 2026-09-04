"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Input, Label, Select, Textarea } from "@/components/ui/input";
import { useToast } from "@/components/toast";

interface Props {
  mode: "create" | "row";
  leases?: { id: string; label: string }[];
  rooms?: { id: string; label: string }[];
  ticket?: { id: string; code: string; status: string; roomNumber: string };
  canUpdate?: boolean;
  canCreateGlobal?: boolean;
  slaHint?: Record<string, number>;
}

const NEXT_OPS: Record<string, Array<{ op: "assign" | "start" | "resolve" | "verify" | "close" | "cancel"; label: string }>> = {
  open: [{ op: "assign", label: "Assign…" }, { op: "cancel", label: "Cancel" }],
  assigned: [{ op: "start", label: "Start work" }, { op: "cancel", label: "Cancel" }],
  in_progress: [{ op: "resolve", label: "Resolve…" }],
  resolved: [{ op: "verify", label: "Verify" }, { op: "close", label: "Close" }],
  verified: [{ op: "close", label: "Close" }]
};

export function TicketActions({ mode, leases = [], rooms = [], ticket, canUpdate, canCreateGlobal, slaHint }: Props) {
  const router = useRouter();
  const { push } = useToast();
  const [busy, setBusy] = useState(false);

  async function post(url: string, body: unknown, okTitle: string, onDone?: () => void) {
    setBusy(true);
    const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const data = (await res.json().catch(() => ({}))) as { message?: string; code?: string; totalMinor?: number };
    setBusy(false);
    if (!res.ok) {
      push({ title: "Failed", description: data.message ?? data.code, variant: "destructive" });
      return;
    }
    push({ title: okTitle, description: data.totalMinor != null ? `ticket cost total ${((data.totalMinor ?? 0) / 100).toFixed(2)}` : undefined, variant: "success" });
    onDone?.();
    router.refresh();
  }

  if (mode === "row") {
    const t = ticket!;
    const ops = canUpdate ? (NEXT_OPS[t.status] ?? []) : [];
    return (
      <div className="flex justify-end gap-1.5">
        {ops.find((o) => o.op === "assign") ? <AssignDialog busy={busy} onDone={(a) => post(`/api/maintenance/tickets/${t.id}`, { op: "assign", ...a }, "Ticket assigned")} /> : null}
        {ops.find((o) => o.op === "start") ? (
          <Button size="sm" variant="secondary" disabled={busy} onClick={() => void post(`/api/maintenance/tickets/${t.id}`, { op: "start" }, "Work started")}>
            Start
          </Button>
        ) : null}
        {ops.find((o) => o.op === "resolve") ? <ResolveDialog busy={busy} onDone={(note) => post(`/api/maintenance/tickets/${t.id}`, { op: "resolve", resolutionNote: note }, "Ticket resolved")} /> : null}
        {["in_progress", "resolved", "verified"].includes(t.status) && canUpdate ? <CostDialog busy={busy} onDone={(cost) => post(`/api/maintenance/tickets/${t.id}`, { op: "add_cost", cost }, "Cost added")} /> : null}
        {ops.find((o) => o.op === "verify") ? (
          <Button size="sm" variant="secondary" disabled={busy} onClick={() => void post(`/api/maintenance/tickets/${t.id}`, { op: "verify" }, "Verified")}>
            Verify
          </Button>
        ) : null}
        {ops.find((o) => o.op === "close") ? (
          <Button size="sm" disabled={busy} onClick={() => void post(`/api/maintenance/tickets/${t.id}`, { op: "close" }, "Ticket closed")}>
            Close
          </Button>
        ) : null}
        {ops.find((o) => o.op === "cancel") ? <CancelDialog busy={busy} onDone={(reason) => post(`/api/maintenance/tickets/${t.id}`, { op: "cancel", reason }, "Ticket cancelled")} /> : null}
      </div>
    );
  }

  if (!canCreateGlobal && leases.length === 0) return null;
  return <CreateDialog busy={busy} leases={leases} rooms={rooms} slaHint={slaHint} onDone={(payload) => post("/api/maintenance/tickets", payload, "Ticket created")} />;
}

function CreateDialog({
  busy,
  leases,
  rooms,
  slaHint,
  onDone
}: {
  busy: boolean;
  leases: { id: string; label: string }[];
  rooms: { id: string; label: string }[];
  slaHint?: Record<string, number>;
  onDone: (payload: Record<string, unknown>) => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [priority, setPriority] = useState("medium");
  return (
    <>
      <Button size="sm" onClick={() => setOpen(true)}>
        New ticket…
      </Button>
      <Dialog open={open} onClose={() => setOpen(false)} title="Log maintenance ticket" description={`SLA target by priority: urgent ${slaHint?.urgent ?? 4}h · high ${slaHint?.high ?? 24}h · medium ${slaHint?.medium ?? 72}h · low ${slaHint?.low ?? 168}h.`} wide>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const fd = new FormData(e.currentTarget);
            const leaseId = String(fd.get("leaseId") ?? "");
            const roomId = String(fd.get("roomId") ?? "");
            void onDone({
              category: String(fd.get("category")),
              priority: String(fd.get("priority")),
              title: String(fd.get("title")),
              description: String(fd.get("description")),
              ...(leaseId ? { leaseId } : { roomId })
            }).then(() => setOpen(false));
          }}
          className="space-y-4"
        >
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="tk-lease">Member lease (portal-style, links the room)</Label>
              <Select id="tk-lease" name="leaseId" defaultValue="">
                <option value="">— no member lease —</option>
                {leases.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.label}
                  </option>
                ))}
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="tk-room">…or room directly (common area)</Label>
              <Select id="tk-room" name="roomId" defaultValue="">
                <option value="">— via lease —</option>
                {rooms.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.label}
                  </option>
                ))}
              </Select>
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="space-y-1.5">
              <Label htmlFor="tk-cat">Category</Label>
              <Select id="tk-cat" name="category" defaultValue="plumbing" required>
                {["plumbing", "electrical", "appliance", "furniture", "internet", "other"].map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="tk-pri">Priority</Label>
              <Select id="tk-pri" name="priority" value={priority} onChange={(e) => setPriority(e.target.value)} required>
                {["low", "medium", "high", "urgent"].map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="tk-title">Title</Label>
              <Input id="tk-title" name="title" minLength={3} maxLength={120} required />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="tk-desc">Description</Label>
            <Textarea id="tk-desc" name="description" rows={3} maxLength={2000} required />
          </div>
          {priority === "urgent" ? <p className="rounded-md bg-destructive/10 p-2 text-xs text-destructive">Urgent: 4-hour SLA — the daily sweep escalates breaches.</p> : null}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={busy}>
              Create ticket
            </Button>
          </div>
        </form>
      </Dialog>
    </>
  );
}

function AssignDialog({ busy, onDone }: { busy: boolean; onDone: (a: { assignedToId?: string; vendorName?: string }) => Promise<void> }) {
  const [open, setOpen] = useState(false);
  return (
    <Dialog open={open} onClose={() => setOpen(false)} title="Assign ticket" description="Assign an in-house technician (user id) or an external vendor.">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          const fd = new FormData(e.currentTarget);
          const assignedToId = String(fd.get("assignedToId") ?? "");
          const vendorName = String(fd.get("vendorName") ?? "");
          void onDone({ ...(assignedToId ? { assignedToId } : {}), ...(vendorName ? { vendorName } : {}) }).then(() => setOpen(false));
        }}
        className="space-y-4"
      >
        <div className="space-y-1.5">
          <Label htmlFor="tk-tech">Technician user id</Label>
          <Input id="tk-tech" name="assignedToId" placeholder="cuid of the technician user" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="tk-vendor">…or vendor name</Label>
          <Input id="tk-vendor" name="vendorName" maxLength={120} placeholder="e.g. CoolAir Services" />
        </div>
        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button type="submit" disabled={busy}>
            Assign
          </Button>
        </div>
      </form>
    </Dialog>
  );
}

function ResolveDialog({ busy, onDone }: { busy: boolean; onDone: (note: string) => Promise<void> }) {
  const [open, setOpen] = useState(false);
  return (
    <Dialog open={open} onClose={() => setOpen(false)} title="Resolve ticket" description="What fixed it? Required before verification/closing.">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          const fd = new FormData(e.currentTarget);
          void onDone(String(fd.get("resolutionNote"))).then(() => setOpen(false));
        }}
        className="space-y-4"
      >
        <div className="space-y-1.5">
          <Label htmlFor="tk-res">Resolution note</Label>
          <Textarea id="tk-res" name="resolutionNote" rows={3} maxLength={1000} required minLength={3} />
        </div>
        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={() => setOpen(false)}>
            Back
          </Button>
          <Button type="submit" disabled={busy}>
            Resolve
          </Button>
        </div>
      </form>
    </Dialog>
  );
}

function CostDialog({ busy, onDone }: { busy: boolean; onDone: (cost: { kind: string; label: string; amount: number; chargeTo: string; stockItemId?: string }) => Promise<void> }) {
  const [open, setOpen] = useState(false);
  return (
    <Dialog open={open} onClose={() => setOpen(false)} title="Add cost line" description="Labor or materials. Materials may reference an M15 stock item (consumption wires up in Phase 14).">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          const fd = new FormData(e.currentTarget);
          void onDone({
            kind: String(fd.get("kind")),
            label: String(fd.get("label")),
            amount: Number(fd.get("amount")),
            chargeTo: String(fd.get("chargeTo")),
            stockItemId: String(fd.get("stockItemId") ?? "") || undefined
          }).then(() => setOpen(false));
        }}
        className="space-y-4"
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="tk-cost-kind">Kind</Label>
            <Select id="tk-cost-kind" name="kind" defaultValue="labor" required>
              <option value="labor">labor</option>
              <option value="material">material</option>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="tk-cost-amt">Amount</Label>
            <Input id="tk-cost-amt" name="amount" type="number" step="0.01" min="0.01" required />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="tk-cost-charge">Charge to</Label>
            <Select id="tk-cost-charge" name="chargeTo" defaultValue="expense" required>
              <option value="expense">expense (M20)</option>
              <option value="owner">owner P&L (M24)</option>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="tk-cost-stock">Stock item id (optional)</Label>
            <Input id="tk-cost-stock" name="stockItemId" placeholder="M15 stock item" />
          </div>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="tk-cost-label">Label</Label>
          <Input id="tk-cost-label" name="label" maxLength={120} required placeholder="e.g. 1.5h technician · tap cartridge" />
        </div>
        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button type="submit" disabled={busy}>
            Add cost
          </Button>
        </div>
      </form>
    </Dialog>
  );
}

function CancelDialog({ busy, onDone }: { busy: boolean; onDone: (reason: string) => Promise<void> }) {
  const [open, setOpen] = useState(false);
  return (
    <Dialog open={open} onClose={() => setOpen(false)} title="Cancel ticket" description="A short reason is required (audit trail).">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          const fd = new FormData(e.currentTarget);
          void onDone(String(fd.get("reason"))).then(() => setOpen(false));
        }}
        className="space-y-4"
      >
        <div className="space-y-1.5">
          <Label htmlFor="tk-cancel">Reason</Label>
          <Textarea id="tk-cancel" name="reason" rows={2} maxLength={300} required minLength={3} />
        </div>
        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={() => setOpen(false)}>
            Keep ticket
          </Button>
          <Button type="submit" variant="destructive" disabled={busy}>
            Cancel ticket
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
