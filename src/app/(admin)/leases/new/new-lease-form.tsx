"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input, Label, Select } from "@/components/ui/input";
import { useToast } from "@/components/toast";
import { Tx } from "@/components/i18n-text";

interface RoomView {
  id: string;
  label: string;
  floorId: string;
  status: string;
  capacity: number;
  basePriceMinor: number;
  beds: Array<{ id: string; label: string; taken: boolean }>;
  wholeRoomFree: boolean;
}

interface ServiceRow {
  name: string;
  amount: string;
}

export function NewLeaseForm({
  members,
  properties,
  buildings,
  floors,
  rooms
}: {
  members: Array<{ id: string; label: string }>;
  properties: Array<{ id: string; label: string }>;
  buildings: Array<{ id: string; label: string; propertyId: string }>;
  floors: Array<{ id: string; label: string; buildingId: string }>;
  rooms: RoomView[];
}) {
  const router = useRouter();
  const { push } = useToast();
  const [busy, setBusy] = useState(false);

  const [memberProfileId, setMemberProfileId] = useState("");
  const [propertyId, setPropertyId] = useState("");
  const [buildingId, setBuildingId] = useState("");
  const [floorId, setFloorId] = useState("");
  const [roomId, setRoomId] = useState("");
  const [bedId, setBedId] = useState("");
  const [startDate, setStartDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [endDate, setEndDate] = useState("");
  const [rent, setRent] = useState("");
  const [cycleDay, setCycleDay] = useState("1");
  const [proration, setProration] = useState("calendar");
  const [deposit, setDeposit] = useState("");
  const [depositInstallments, setDepositInstallments] = useState("1");
  const [noticeDays, setNoticeDays] = useState("30");
  const [autoRenew, setAutoRenew] = useState(false);
  const [escalation, setEscalation] = useState("");
  const [services, setServices] = useState<ServiceRow[]>([{ name: "", amount: "" }]);

  const visibleBuildings = useMemo(() => buildings.filter((b) => b.propertyId === propertyId), [buildings, propertyId]);
  const visibleFloors = useMemo(() => floors.filter((f) => f.buildingId === buildingId), [floors, buildingId]);
  const visibleRooms = useMemo(() => rooms.filter((r) => r.floorId === floorId), [rooms, floorId]);
  const room = rooms.find((r) => r.id === roomId);

  function pickRoom(id: string) {
    setRoomId(id);
    setBedId("");
    const r = rooms.find((x) => x.id === id);
    if (r && !rent) setRent((r.basePriceMinor / 100).toFixed(2));
  }

  function setService(i: number, patch: Partial<ServiceRow>) {
    setServices((prev) => prev.map((s, idx) => (idx === i ? { ...s, ...patch } : s)));
  }

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!memberProfileId || !roomId) {
      push({ title: "Pick a member and a room first", variant: "destructive" });
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/leases", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          memberProfileId,
          roomId,
          bedId: bedId || null,
          startDate: new Date(`${startDate}T00:00:00.000Z`).toISOString(),
          endDate: endDate ? new Date(`${endDate}T00:00:00.000Z`).toISOString() : null,
          rentAmount: Number(rent),
          billingCycleDay: Number(cycleDay),
          prorationBasis: proration,
          depositTotal: deposit ? Number(deposit) : 0,
          depositInstallments: Number(depositInstallments),
          noticeDays: Number(noticeDays),
          autoRenew,
          escalationPercent: escalation ? Number(escalation) : null,
          services: services
            .filter((s) => s.name.trim().length >= 2 && s.amount !== "")
            .map((s) => ({ name: s.name, amount: Number(s.amount) }))
        })
      });
      const body = (await res.json().catch(() => ({}))) as { id?: string; code?: string; message?: string };
      if (!res.ok || !body.id) {
        push({ title: "Could not create lease", description: body.message, variant: "destructive" });
        return;
      }
      push({ title: `Draft lease ${body.code} created`, description: "Review it, then activate to apply occupancy effects.", variant: "success" });
      router.push(`/leases/${body.id}`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <CardContent className="p-6">
        <form onSubmit={submit} className="space-y-6">
          <section className="space-y-3">
            <p className="text-sm font-medium"><Tx>Member</Tx></p>
            <div className="space-y-1.5">
              <Label htmlFor="l-member">Member (verified/active, not blacklisted)</Label>
              <Select id="l-member" value={memberProfileId} onChange={(e) => setMemberProfileId(e.target.value)} required>
                <option value="">— select member —</option>
                {members.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.label}
                  </option>
                ))}
              </Select>
              <p className="text-xs text-muted-foreground"><Tx>Prospects must complete KYC and be verified first (Members page).</Tx></p>
            </div>
          </section>

          <section className="space-y-3">
            <p className="text-sm font-medium"><Tx>Premises</Tx></p>
            <div className="grid gap-3 sm:grid-cols-4">
              <div className="space-y-1.5">
                <Label>Property</Label>
                <Select value={propertyId} onChange={(e) => { setPropertyId(e.target.value); setBuildingId(""); setFloorId(""); setRoomId(""); setBedId(""); }}>
                  <option value="">—</option>
                  {properties.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.label}
                    </option>
                  ))}
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Building</Label>
                <Select value={buildingId} onChange={(e) => { setBuildingId(e.target.value); setFloorId(""); setRoomId(""); setBedId(""); }} disabled={!propertyId}>
                  <option value="">—</option>
                  {visibleBuildings.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.label}
                    </option>
                  ))}
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Floor</Label>
                <Select value={floorId} onChange={(e) => { setFloorId(e.target.value); setRoomId(""); setBedId(""); }} disabled={!buildingId}>
                  <option value="">—</option>
                  {visibleFloors.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.label}
                    </option>
                  ))}
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Room</Label>
                <Select value={roomId} onChange={(e) => pickRoom(e.target.value)} disabled={!floorId}>
                  <option value="">—</option>
                  {visibleRooms.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.label} · {r.status} · {r.capacity} bed(s)
                    </option>
                  ))}
                </Select>
              </div>
            </div>
            {room ? (
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="l-bed">Bed (optional — co-living)</Label>
                  <Select id="l-bed" value={bedId} onChange={(e) => setBedId(e.target.value)}>
                    <option value="">Entire room {room.wholeRoomFree ? "(free)" : "(taken)"}</option>
                    {room.beds.map((b) => (
                      <option key={b.id} value={b.id} disabled={b.taken}>
                        {b.label} {b.taken ? "(leased)" : ""}
                      </option>
                    ))}
                  </Select>
                </div>
                <div className="flex items-end">
                  <p className="text-xs text-muted-foreground">
                    Status: {room.status} · capacity {room.capacity} · list price {(room.basePriceMinor / 100).toFixed(2)}/mo. One
                    active lease per bed; capacity enforced at activation.
                  </p>
                </div>
              </div>
            ) : null}
          </section>

          <section className="space-y-3">
            <p className="text-sm font-medium"><Tx>Term & rent</Tx></p>
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="space-y-1.5">
                <Label htmlFor="l-start">Start date *</Label>
                <Input id="l-start" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} required />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="l-end">End date (optional)</Label>
                <Input id="l-end" type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} min={startDate} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="l-rent">Rent / month *</Label>
                <Input id="l-rent" type="number" step="0.01" min="0" value={rent} onChange={(e) => setRent(e.target.value)} required />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="l-cycle">Billing cycle day (1–28)</Label>
                <Input id="l-cycle" type="number" min="1" max="28" value={cycleDay} onChange={(e) => setCycleDay(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="l-proration">Proration basis</Label>
                <Select id="l-proration" value={proration} onChange={(e) => setProration(e.target.value)}>
                  <option value="calendar">Calendar days</option>
                  <option value="thirty_day">30-day month</option>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="l-esc">Escalation % / year (optional)</Label>
                <Input id="l-esc" type="number" min="0" max="50" value={escalation} onChange={(e) => setEscalation(e.target.value)} />
              </div>
            </div>
          </section>

          <section className="space-y-3">
            <p className="text-sm font-medium"><Tx>Deposit & notice</Tx></p>
            <div className="grid gap-3 sm:grid-cols-4">
              <div className="space-y-1.5">
                <Label htmlFor="l-dep">Deposit total</Label>
                <Input id="l-dep" type="number" step="0.01" min="0" value={deposit} onChange={(e) => setDeposit(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="l-depi">Installments</Label>
                <Input id="l-depi" type="number" min="1" max="12" value={depositInstallments} onChange={(e) => setDepositInstallments(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="l-notice">Notice days</Label>
                <Input id="l-notice" type="number" min="0" max="180" value={noticeDays} onChange={(e) => setNoticeDays(e.target.value)} />
              </div>
              <label className="flex items-end gap-2 pb-2 text-sm">
                <input type="checkbox" className="h-4 w-4" checked={autoRenew} onChange={(e) => setAutoRenew(e.target.checked)} />
                Auto-renew
              </label>
            </div>
          </section>

          <section className="space-y-3">
            <p className="text-sm font-medium"><Tx>Included services (monthly add-ons)</Tx></p>
            {services.map((s, i) => (
              <div key={i} className="grid grid-cols-[1fr_140px_auto] gap-2">
                <Input placeholder="Service (e.g. WiFi)" value={s.name} onChange={(e) => setService(i, { name: e.target.value })} />
                <Input placeholder="Amount / mo" type="number" step="0.01" min="0" value={s.amount} onChange={(e) => setService(i, { amount: e.target.value })} />
                <Button variant="ghost" className="text-destructive" disabled={services.length === 1} onClick={() => setServices((prev) => prev.filter((_, idx) => idx !== i))}>
                  ✕
                </Button>
              </div>
            ))}
            <Button variant="outline" size="sm" onClick={() => setServices((prev) => [...prev, { name: "", amount: "" }])}>
              + Add service
            </Button>
          </section>

          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => router.push("/leases")}>
              Cancel
            </Button>
            <Button type="submit" variant="success" disabled={busy}>
              {busy ? "Creating…" : "Create draft lease"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
