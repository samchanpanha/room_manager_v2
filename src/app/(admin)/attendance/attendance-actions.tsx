"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Input, Label, Select } from "@/components/ui/input";
import { useToast } from "@/components/toast";
import { Tx } from "@/components/i18n-text";

async function post(url: string, body: unknown): Promise<{ ok: boolean; message?: string; data?: Record<string, unknown> }> {
  const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  return { ok: res.ok, message: (data.message as string) ?? (data.code as string), data };
}

/// Kiosk widget (§M23): PIN clock for the shared terminal, plus a session
/// "mobile" clock and self-service PIN setup for logged-in staff.
export function KioskCard({ properties, isStaff }: { properties: { id: string; label: string }[]; isStaff: boolean }) {
  const router = useRouter();
  const { push } = useToast();
  const [busy, setBusy] = useState(false);
  const [pinOpen, setPinOpen] = useState(false);

  async function clock(action: "in" | "out", via: "kiosk" | "mobile") {
    setBusy(true);
    const propertyId = (document.getElementById("att-property") as HTMLSelectElement | null)?.value ?? properties[0]?.id;
    const pin = (document.getElementById("att-pin") as HTMLInputElement | null)?.value ?? "";
    const body = via === "kiosk" ? { propertyId, pin, action } : { propertyId, action };
    const r = await post(via === "kiosk" ? "/api/attendance/kiosk" : "/api/attendance/mobile", body);
    setBusy(false);
    if (!r.ok) {
      push({ title: "Failed", description: r.message, variant: "destructive" });
      return;
    }
    const d = r.data as { userName?: string; minutesWorked?: number | null } | undefined;
    push({
      title: `${d?.userName ?? "You"} clocked ${action.toUpperCase()}`,
      description: action === "out" && d?.minutesWorked != null ? `${Math.floor(d.minutesWorked / 60)}h ${d.minutesWorked % 60}m recorded` : undefined,
      variant: "success"
    });
    (document.getElementById("att-pin") as HTMLInputElement | null)!.value = "";
    router.refresh();
  }

  return (
    <div className="mb-4 rounded-lg border bg-muted/30 p-4">
      <div className="mb-3 text-sm font-semibold"><Tx>Kiosk</Tx></div>
      <div className="flex flex-wrap items-end gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="att-property">Property</Label>
          <Select id="att-property" defaultValue={properties[0]?.id}>
            {properties.map((p) => (
              <option key={p.id} value={p.id}>
                {p.label}
              </option>
            ))}
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="att-pin">Kiosk PIN</Label>
          <Input id="att-pin" inputMode="numeric" placeholder="••••" className="w-24 tracking-widest" />
        </div>
        <Button size="sm" variant="success" disabled={busy} onClick={() => void clock("in", "kiosk")}>
          Clock IN
        </Button>
        <Button size="sm" variant="destructive" disabled={busy} onClick={() => void clock("out", "kiosk")}>
          Clock OUT
        </Button>
        {isStaff ? (
          <>
            <Button size="sm" variant="outline" disabled={busy} onClick={() => void clock("in", "mobile")}>
              Mobile in
            </Button>
            <Button size="sm" variant="outline" disabled={busy} onClick={() => void clock("out", "mobile")}>
              Mobile out
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setPinOpen(true)}>
              Set my PIN…
            </Button>
          </>
        ) : null}
      </div>
      <PinDialog open={pinOpen} onClose={() => setPinOpen(false)} />
    </div>
  );
}

function PinDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { push } = useToast();
  const [busy, setBusy] = useState(false);
  return (
    <Dialog open={open} onClose={onClose} title="Set kiosk PIN" description="4–8 digits — this is your shared-terminal clock credential.">
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          const fd = new FormData(e.currentTarget);
          setBusy(true);
          const r = await post("/api/attendance/kiosk-pin", { pin: String(fd.get("pin")) });
          setBusy(false);
          if (!r.ok) {
            push({ title: "Failed", description: r.message, variant: "destructive" });
            return;
          }
          push({ title: "PIN saved", variant: "success" });
          onClose();
        }}
        className="space-y-4"
      >
        <div className="space-y-1.5">
          <Label htmlFor="pin-new">New PIN</Label>
          <Input id="pin-new" name="pin" inputMode="numeric" pattern="\d{4,8}" required />
        </div>
        <Button type="submit" disabled={busy}>
          Save PIN
        </Button>
      </form>
    </Dialog>
  );
}

interface Props {
  properties: { id: string; label: string }[];
  staff: { id: string; label: string }[];
  month: string;
  firstPropertyId: string | null;
  records: { id: string; label: string; clockInAt: string; clockOutAt: string | null }[];
  exceptions: { id: string; label: string }[];
}

/// Manager tools (M23:update): manual entry for missed punches, audited
/// corrections, exception resolution, the sweep, and the payroll CSV export.
export function AttendanceAdmin({ properties, staff, month, firstPropertyId, records, exceptions }: Props) {
  const router = useRouter();
  const { push } = useToast();
  const [busy, setBusy] = useState(false);
  const propertyId = firstPropertyId ?? properties[0]?.id ?? "";

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
      <ManualDialog busy={busy} properties={properties} staff={staff} onDone={(b) => run("/api/attendance/records", b, "Manual record created")} />
      <EditDialog busy={busy} records={records} onDone={(id, b) => run(`/api/attendance/records/${id}/edit`, b, "Record corrected")} />
      <ResolveDialog busy={busy} exceptions={exceptions} onDone={(id, b) => run(`/api/attendance/exceptions/${id}/resolve`, b, "Exception resolved")} />
      <Button size="sm" variant="outline" disabled={busy} onClick={() => void run("/api/jobs/attendance-sweep", {}, "Sweep complete")}>
        Run missed-punch sweep
      </Button>
      {propertyId ? (
        <a href={`/api/attendance/export?propertyId=${propertyId}&month=${month}`} className="inline-flex h-8 items-center rounded-md border px-3 text-sm hover:bg-accent">
          Export CSV ({month})
        </a>
      ) : null}
    </div>
  );
}

function ManualDialog({ busy, properties, staff, onDone }: { busy: boolean; properties: { id: string; label: string }[]; staff: { id: string; label: string }[]; onDone: (b: Record<string, unknown>) => Promise<void> }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button size="sm" onClick={() => setOpen(true)}>
        Manual entry…
      </Button>
      <Dialog open={open} onClose={() => setOpen(false)} title="Manual attendance record" description="For missed punches — the reason is mandatory and audited (§M23).">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const fd = new FormData(e.currentTarget);
            void onDone({
              propertyId: String(fd.get("propertyId")),
              userId: String(fd.get("userId")),
              clockInAt: new Date(String(fd.get("clockInAt"))).toISOString(),
              clockOutAt: fd.get("clockOutAt") ? new Date(String(fd.get("clockOutAt"))).toISOString() : null,
              reason: String(fd.get("reason")),
              note: String(fd.get("note") ?? "") || undefined
            }).then(() => setOpen(false));
          }}
          className="space-y-4"
        >
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="attm-prop">Property</Label>
              <Select id="attm-prop" name="propertyId" defaultValue={properties[0]?.id} required>
                {properties.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.label}
                  </option>
                ))}
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="attm-staff">Staff</Label>
              <Select id="attm-staff" name="userId" defaultValue={staff[0]?.id} required>
                {staff.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.label}
                  </option>
                ))}
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="attm-in">Clock in</Label>
              <Input id="attm-in" name="clockInAt" type="datetime-local" required />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="attm-out">Clock out</Label>
              <Input id="attm-out" name="clockOutAt" type="datetime-local" />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="attm-reason">Reason (audited)</Label>
            <Input id="attm-reason" name="reason" minLength={3} required placeholder="forgot to clock out on Tuesday" />
          </div>
          <Button type="submit" disabled={busy}>
            Create record
          </Button>
        </form>
      </Dialog>
    </>
  );
}

function EditDialog({ busy, records, onDone }: { busy: boolean; records: { id: string; label: string; clockInAt: string; clockOutAt: string | null }[]; onDone: (id: string, b: Record<string, unknown>) => Promise<void> }) {
  const [open, setOpen] = useState(false);
  const [id, setId] = useState(records[0]?.id ?? "");
  const current = records.find((r) => r.id === id);
  return (
    <>
      <Button size="sm" variant="outline" disabled={records.length === 0} onClick={() => setOpen(true)}>
        Correct punch…
      </Button>
      <Dialog open={open} onClose={() => setOpen(false)} title="Correct a punch" description="Every correction stamps who/why on the record and writes an audit row.">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const fd = new FormData(e.currentTarget);
            const clockOut = String(fd.get("clockOutAt") ?? "");
            void onDone(id, {
              clockInAt: new Date(String(fd.get("clockInAt"))).toISOString(),
              ...(clockOut ? { clockOutAt: new Date(clockOut).toISOString() } : { clockOutAt: null }),
              reason: String(fd.get("reason"))
            }).then(() => setOpen(false));
          }}
          className="space-y-4"
        >
          <div className="space-y-1.5">
            <Label htmlFor="atte-rec">Record</Label>
            <Select
              id="atte-rec"
              value={id}
              onChange={(e) => setId(e.target.value)}
              required
            >
              {records.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.label}
                </option>
              ))}
            </Select>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="atte-in">Clock in (UTC)</Label>
              <Input id="atte-in" name="clockInAt" type="datetime-local" defaultValue={current ? current.clockInAt.slice(0, 16) : ""} required />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="atte-out">Clock out (UTC)</Label>
              <Input id="atte-out" name="clockOutAt" type="datetime-local" defaultValue={current?.clockOutAt ? current.clockOutAt.slice(0, 16) : ""} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="atte-reason">Reason (audited)</Label>
            <Input id="atte-reason" name="reason" minLength={3} required placeholder="kiosk was offline — true times per supervisor" />
          </div>
          <Button type="submit" disabled={busy}>
            Save correction
          </Button>
        </form>
      </Dialog>
    </>
  );
}

function ResolveDialog({ busy, exceptions, onDone }: { busy: boolean; exceptions: { id: string; label: string }[]; onDone: (id: string, b: Record<string, unknown>) => Promise<void> }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button size="sm" variant="outline" disabled={exceptions.length === 0} onClick={() => setOpen(true)}>
        Resolve exception…
      </Button>
      <Dialog open={open} onClose={() => setOpen(false)} title="Resolve exception" description="Resolved exceptions stay in history and are not re-flagged.">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const fd = new FormData(e.currentTarget);
            void onDone(String(fd.get("exceptionId")), { resolution: String(fd.get("resolution")) }).then(() => setOpen(false));
          }}
          className="space-y-4"
        >
          <div className="space-y-1.5">
            <Label htmlFor="attr-exc">Exception</Label>
            <Select id="attr-exc" name="exceptionId" defaultValue={exceptions[0]?.id} required>
              {exceptions.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.label}
                </option>
              ))}
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="attr-res">Resolution</Label>
            <Input id="attr-res" name="resolution" minLength={3} required placeholder="confirmed with supervisor" />
          </div>
          <Button type="submit" disabled={busy}>
            Resolve
          </Button>
        </form>
      </Dialog>
    </>
  );
}
