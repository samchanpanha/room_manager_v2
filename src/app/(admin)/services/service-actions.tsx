"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Input, Label, Select } from "@/components/ui/input";
import { useToast } from "@/components/toast";

interface CatalogRef {
  id: string;
  name: string;
  pricingModel: string;
}

interface Props {
  /** When provided (create-capable user), renders the "Assign service" button + dialog. */
  catalog: CatalogRef[];
  slots: { code: string; label: string }[];
  wifi: { ssid: string; label: string }[];
  /** Row-level suspend target. */
  suspendTarget: { id: string } | null;
  /** Row-level record-usage target (per_use assignments only). */
  usageTarget: { leaseId: string; serviceId: string; unitLabel: string } | null;
}

export function ServiceActions({ catalog, slots, wifi, suspendTarget, usageTarget }: Props) {
  const router = useRouter();
  const { push } = useToast();
  const [busy, setBusy] = useState(false);
  const [assignOpen, setAssignOpen] = useState(false);
  const [usageOpen, setUsageOpen] = useState(false);

  const selected = catalog[0];

  async function post(url: string, body: unknown, okTitle: string) {
    setBusy(true);
    const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const data = (await res.json().catch(() => ({}))) as { message?: string };
    setBusy(false);
    if (!res.ok) {
      push({ title: "Failed", description: data.message, variant: "destructive" });
      return false;
    }
    push({ title: okTitle, variant: "success" });
    router.refresh();
    return true;
  }

  if (!suspendTarget && !usageTarget && catalog.length === 0) {
    return <span className="text-xs text-muted-foreground">—</span>;
  }

  return (
    <div className="flex justify-end gap-1.5">
      {catalog.length > 0 ? (
        <Button size="sm" disabled={busy} onClick={() => setAssignOpen(true)}>
          Assign service…
        </Button>
      ) : null}
      {suspendTarget ? (
        <Button
          size="sm"
          variant="secondary"
          disabled={busy}
          onClick={() => {
            void post(`/api/services/assignments/${suspendTarget.id}/suspend`, {}, "Service suspended — the current cycle bills the active days only");
          }}
        >
          Suspend
        </Button>
      ) : null}
      {usageTarget ? (
        <Button size="sm" variant="outline" disabled={busy} onClick={() => setUsageOpen(true)}>
          Record use…
        </Button>
      ) : null}

      <Dialog
        open={assignOpen}
        onClose={() => setAssignOpen(false)}
        title="Assign service to lease"
        description="fixed_monthly services ride every invoice until suspended (prorated stop). Pick a parking slot or WiFi account to bind a real resource."
      >
        <AssignForm
          catalog={catalog}
          slots={slots}
          wifi={wifi}
          busy={busy}
          onCancel={() => setAssignOpen(false)}
          onSubmit={(leaseId, body) =>
            post("/api/services/assignments", { leaseId, ...body }, "Service assigned").then((done) => {
              if (done) setAssignOpen(false);
              return done;
            })
          }
          selected={selected}
        />
      </Dialog>

      <Dialog
        open={usageOpen}
        onClose={() => setUsageOpen(false)}
        title="Record per-use entry"
        description="Rides the next generated invoice as a one-time line (§M12)."
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!usageTarget) return;
            const fd = new FormData(e.currentTarget);
            void post(
              "/api/services/usages",
              { leaseId: usageTarget.leaseId, serviceId: usageTarget.serviceId, qty: Number(fd.get("qty")), note: String(fd.get("note") ?? "") || undefined },
              "Usage recorded"
            ).then((done) => {
              if (done) setUsageOpen(false);
            });
          }}
          className="space-y-4"
        >
          <div className="space-y-1.5">
            <Label htmlFor="su-qty">Quantity ({usageTarget?.unitLabel ?? "unit"})</Label>
            <Input id="su-qty" name="qty" type="number" step="0.001" min="0.001" required />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="su-note">Note</Label>
            <Input id="su-note" name="note" maxLength={300} placeholder="optional" />
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setUsageOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={busy}>
              Record
            </Button>
          </div>
        </form>
      </Dialog>
    </div>
  );
}

function AssignForm({
  catalog,
  slots,
  wifi,
  busy,
  selected,
  onCancel,
  onSubmit
}: {
  catalog: CatalogRef[];
  slots: { code: string; label: string }[];
  wifi: { ssid: string; label: string }[];
  busy: boolean;
  selected: CatalogRef | undefined;
  onCancel: () => void;
  onSubmit: (leaseId: string, body: Record<string, unknown>) => Promise<boolean>;
}) {
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        const slot = String(fd.get("parkingSlotCode") ?? "");
        const ssid = String(fd.get("wifiSsid") ?? "");
        void onSubmit(String(fd.get("leaseId")), {
          serviceId: String(fd.get("serviceId")),
          parkingSlotCode: slot || undefined,
          wifiSsid: ssid || undefined,
          note: String(fd.get("note") ?? "") || undefined
        });
      }}
      className="space-y-4"
    >
      <div className="space-y-1.5">
        <Label htmlFor="sa-lease">Lease ID</Label>
        <Input id="sa-lease" name="leaseId" placeholder="cuid of an active lease (copy from the leases page)" required />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="sa-service">Service</Label>
        <Select id="sa-service" name="serviceId" defaultValue={selected?.id}>
          {catalog.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </Select>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="sa-slot">Parking slot (optional)</Label>
          <Select id="sa-slot" name="parkingSlotCode" defaultValue="">
            <option value="">— none —</option>
            {slots.map((s) => (
              <option key={s.code} value={s.code}>
                {s.label}
              </option>
            ))}
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="sa-wifi">WiFi account (optional)</Label>
          <Select id="sa-wifi" name="wifiSsid" defaultValue="">
            <option value="">— none —</option>
            {wifi.map((w) => (
              <option key={w.ssid} value={w.ssid}>
                {w.label}
              </option>
            ))}
          </Select>
        </div>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="sa-note">Note</Label>
        <Input id="sa-note" name="note" maxLength={300} placeholder="optional" />
      </div>
      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" disabled={busy}>
          Assign
        </Button>
      </div>
    </form>
  );
}
