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
  moveId?: string;
  status?: string;
  isOwn?: boolean;
  canTransition?: boolean;
}

export function MoveActions({ mode, leases = [], rooms = [], moveId, status, isOwn, canTransition }: Props) {
  const router = useRouter();
  const { push } = useToast();
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);

  async function post(url: string, body: unknown, okTitle: string) {
    setBusy(true);
    const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const data = (await res.json().catch(() => ({}))) as { message?: string; netMinor?: number; invoiceCode?: string };
    setBusy(false);
    if (!res.ok) {
      push({ title: "Failed", description: data.message, variant: "destructive" });
      return null;
    }
    push({ title: okTitle, description: data.invoiceCode ? `adjustment invoice ${data.invoiceCode} · net ${((data.netMinor ?? 0) / 100).toFixed(2)}` : undefined, variant: "success" });
    router.refresh();
    return data;
  }

  if (mode === "row") {
    const canCancel = (isOwn || canTransition) && (status === "requested" || status === "approved");
    return (
      <div className="flex justify-end gap-1.5">
        {status === "requested" && canTransition ? (
          <Button size="sm" variant="secondary" disabled={busy} onClick={() => void post(`/api/room-moves/${moveId}/approve`, {}, "Move approved")}>
            Approve
          </Button>
        ) : null}
        {status === "approved" && canTransition ? (
          <Button size="sm" disabled={busy} onClick={() => void post(`/api/room-moves/${moveId}/execute`, {}, "Move executed")}>
            Execute
          </Button>
        ) : null}
        {canCancel ? <CancelButton moveId={moveId!} busy={busy} onDone={(r) => post(`/api/room-moves/${moveId}/cancel`, { reason: r }, "Move cancelled")} /> : null}
        {!canCancel && status !== "requested" && status !== "approved" ? <span className="text-xs text-muted-foreground">{status === "executed" ? "done" : "—"}</span> : null}
      </div>
    );
  }

  async function refreshPreview(fd: FormData) {
    const fromLeaseId = String(fd.get("fromLeaseId") ?? "");
    const toRoomId = String(fd.get("toRoomId") ?? "");
    const date = String(fd.get("effectiveAt") ?? "");
    if (!fromLeaseId || !toRoomId || !date) {
      setPreview(null);
      return;
    }
    const res = await fetch("/api/room-moves/preview", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fromLeaseId, toRoomId, effectiveAt: new Date(date).toISOString() })
    });
    const data = (await res.json().catch(() => ({}))) as {
      proration?: { newRentChargeMinor: number; oldRentCreditMinor: number; moveFeeMinor: number; netMinor: number; factor: string };
      message?: string;
    };
    if (!res.ok || !data.proration) {
      setPreview(data.message ?? "Preview unavailable");
      return;
    }
    const p = data.proration;
    setPreview(
      `New rent ${((p.newRentChargeMinor ?? 0) / 100).toFixed(2)} − old-rent credit ${((p.oldRentCreditMinor ?? 0) / 100).toFixed(2)} + fee ${((p.moveFeeMinor ?? 0) / 100).toFixed(2)} = net ${((p.netMinor ?? 0) / 100).toFixed(2)} (${p.factor})`
    );
  }

  return (
    <>
      <Button size="sm" onClick={() => setOpen(true)}>
        Request move…
      </Button>
      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title="Request room move"
        description="Pick the target room and effective date — the system computes the rent proration delta, deposit delta and move fee. An approver then executes."
        wide
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const fd = new FormData(e.currentTarget);
            void post(
              "/api/room-moves",
              {
                fromLeaseId: String(fd.get("fromLeaseId")),
                toRoomId: String(fd.get("toRoomId")),
                effectiveAt: new Date(String(fd.get("effectiveAt"))).toISOString(),
                note: String(fd.get("note") ?? "") || undefined
              },
              "Move requested"
            ).then((okDone) => {
              if (okDone) setOpen(false);
            });
          }}
          onChange={(e) => void refreshPreview(new FormData(e.currentTarget as HTMLFormElement))}
          className="space-y-4"
        >
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="rm-lease">From lease</Label>
              <Select id="rm-lease" name="fromLeaseId" defaultValue={leases[0]?.id} required>
                {leases.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.label}
                  </option>
                ))}
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="rm-room">Target room</Label>
              <Select id="rm-room" name="toRoomId" defaultValue={rooms[0]?.id} required>
                {rooms.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.label}
                  </option>
                ))}
              </Select>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="rm-date">Effective date</Label>
            <Input id="rm-date" name="effectiveAt" type="date" required />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="rm-note">Note</Label>
            <Textarea id="rm-note" name="note" rows={2} maxLength={300} placeholder="optional" />
          </div>
          {preview ? <p className="rounded-md bg-muted p-2 text-xs">{preview}</p> : null}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={busy}>
              Submit request
            </Button>
          </div>
        </form>
      </Dialog>
    </>
  );
}

function CancelButton({ moveId, busy, onDone }: { moveId: string; busy: boolean; onDone: (reason: string) => Promise<unknown> }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button size="sm" variant="outline" disabled={busy} onClick={() => setOpen(true)}>
        Cancel
      </Button>
      <Dialog open={open} onClose={() => setOpen(false)} title="Cancel room move" description="A short reason is required (audit trail).">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const fd = new FormData(e.currentTarget);
            void onDone(String(fd.get("reason"))).then(() => setOpen(false));
          }}
          className="space-y-4"
        >
          <div className="space-y-1.5">
            <Label htmlFor={`rc-${moveId}`}>Reason</Label>
            <Textarea id={`rc-${moveId}`} name="reason" rows={2} required minLength={3} maxLength={300} />
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Keep move
            </Button>
            <Button type="submit" variant="destructive" disabled={busy}>
              Cancel move
            </Button>
          </div>
        </form>
      </Dialog>
    </>
  );
}
