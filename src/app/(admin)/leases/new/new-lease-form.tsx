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
  number?: string;
  floorId: string;
  buildingId?: string;
  propertyId?: string;
  status: string;
  capacity: number;
  basePriceMinor: number;
  beds: Array<{ id: string; label: string; taken: boolean }>;
  wholeRoomFree: boolean;
}

interface CatalogItem {
  id: string;
  code: string;
  name: string;
  pricingModel: string;
  unitPriceMinor: number;
  unitLabel?: string | null;
}

interface ParkingSlotRef {
  id: string;
  code: string;
  propertyId: string;
  monthlyFeeMinor: number;
}

interface WifiAccountRef {
  id: string;
  ssid: string;
  propertyId: string;
  speedLabel?: string | null;
}

interface ServiceRow {
  serviceId?: string;
  name: string;
  amount: string;
  pricingModel: string;
  parkingSlotCode?: string;
  wifiSsid?: string;
}

export function NewLeaseForm({
  members,
  properties,
  buildings,
  floors,
  rooms,
  catalog = [],
  parkingSlots = [],
  wifiAccounts = []
}: {
  members: Array<{ id: string; label: string; status?: string; name?: string }>;
  properties: Array<{ id: string; label: string }>;
  buildings: Array<{ id: string; label: string; propertyId: string }>;
  floors: Array<{ id: string; label: string; buildingId: string }>;
  rooms: RoomView[];
  catalog?: CatalogItem[];
  parkingSlots?: ParkingSlotRef[];
  wifiAccounts?: WifiAccountRef[];
}) {
  const router = useRouter();
  const { push } = useToast();
  const [busy, setBusy] = useState(false);

  // Form State
  const [memberProfileId, setMemberProfileId] = useState("");
  const [memberSearch, setMemberSearch] = useState("");
  const [propertyId, setPropertyId] = useState(() => (properties.length === 1 ? properties[0]?.id ?? "" : ""));
  const [buildingId, setBuildingId] = useState(() => (buildings.length === 1 ? buildings[0]?.id ?? "" : ""));
  const [floorId, setFloorId] = useState(() => (floors.length === 1 ? floors[0]?.id ?? "" : ""));
  const [roomId, setRoomId] = useState("");
  const [roomSearch, setRoomSearch] = useState("");
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
  const [services, setServices] = useState<ServiceRow[]>([]);

  // Validation & Error state
  const [formError, setFormError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const selectedMember = useMemo(() => members.find((m) => m.id === memberProfileId), [members, memberProfileId]);

  const filteredMembers = useMemo(() => {
    if (!memberSearch.trim()) return members;
    const q = memberSearch.toLowerCase();
    return members.filter((m) => m.label.toLowerCase().includes(q) || (m.name && m.name.toLowerCase().includes(q)));
  }, [members, memberSearch]);

  const visibleBuildings = useMemo(() => (!propertyId ? buildings : buildings.filter((b) => b.propertyId === propertyId)), [buildings, propertyId]);
  const visibleFloors = useMemo(() => (!buildingId ? floors : floors.filter((f) => f.buildingId === buildingId)), [floors, buildingId]);
  
  const filteredRooms = useMemo(() => {
    let list = rooms;
    if (floorId) {
      list = list.filter((r) => r.floorId === floorId);
    } else if (buildingId) {
      list = list.filter((r) => r.buildingId === buildingId);
    } else if (propertyId) {
      list = list.filter((r) => r.propertyId === propertyId);
    }
    if (roomSearch.trim()) {
      const q = roomSearch.toLowerCase();
      list = list.filter((r) => r.label.toLowerCase().includes(q) || (r.number && r.number.toLowerCase().includes(q)));
    }
    return list;
  }, [rooms, floorId, buildingId, propertyId, roomSearch]);

  const selectedRoom = useMemo(() => rooms.find((r) => r.id === roomId), [rooms, roomId]);

  const availableSlots = useMemo(() => parkingSlots.filter((s) => !propertyId || s.propertyId === propertyId), [parkingSlots, propertyId]);
  const availableWifi = useMemo(() => wifiAccounts.filter((w) => !propertyId || w.propertyId === propertyId), [wifiAccounts, propertyId]);

  function clearFieldError(field: string) {
    if (fieldErrors[field]) {
      setFieldErrors((prev) => {
        const next = { ...prev };
        delete next[field];
        return next;
      });
    }
    if (formError) setFormError(null);
  }

  function pickRoom(id: string) {
    setRoomId(id);
    setBedId("");
    clearFieldError("room");
    const r = rooms.find((x) => x.id === id);
    if (r) {
      if (!rent || rent === "0") {
        setRent((r.basePriceMinor / 100).toFixed(2));
        clearFieldError("rent");
      }
      if (r.propertyId && r.propertyId !== propertyId) setPropertyId(r.propertyId);
      if (r.buildingId && r.buildingId !== buildingId) setBuildingId(r.buildingId);
      if (r.floorId && r.floorId !== floorId) setFloorId(r.floorId);
    }
  }

  function addCatalogService(c: CatalogItem) {
    const isParking = c.code === "PARK" || c.name.toLowerCase().includes("parking");
    const isWifi = c.code === "WIFI" || c.name.toLowerCase().includes("wifi");
    const defaultSlot = isParking && availableSlots.length > 0 ? availableSlots[0]?.code : undefined;
    const defaultWifi = isWifi && availableWifi.length > 0 ? availableWifi[0]?.ssid : undefined;
    const amount = (c.unitPriceMinor / 100).toFixed(2);

    setServices((prev) => [
      ...prev,
      {
        serviceId: c.id,
        name: c.name,
        amount,
        pricingModel: c.pricingModel,
        parkingSlotCode: defaultSlot,
        wifiSsid: defaultWifi
      }
    ]);
  }

  function addCustomService() {
    setServices((prev) => [
      ...prev,
      {
        name: "",
        amount: "",
        pricingModel: "fixed_monthly"
      }
    ]);
  }

  function setService(i: number, patch: Partial<ServiceRow>) {
    setServices((prev) => prev.map((s, idx) => (idx === i ? { ...s, ...patch } : s)));
    clearFieldError("services");
  }

  const monthlyServicesTotal = useMemo(() => {
    return services
      .filter((s) => s.pricingModel === "fixed_monthly" && !isNaN(Number(s.amount)))
      .reduce((sum, s) => sum + Number(s.amount), 0);
  }, [services]);

  const monthlyTotalEstimate = (Number(rent) || 0) + monthlyServicesTotal;

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setFormError(null);

    // Strict Client-side validation with explicit, clear error messages
    const errors: Record<string, string> = {};

    if (!memberProfileId) {
      errors.member = "Please select a member for this lease.";
    }

    if (!roomId) {
      errors.room = "Please select a room for this lease.";
    }

    if (!startDate || isNaN(Date.parse(startDate))) {
      errors.startDate = "Please specify a valid start date.";
    }

    if (!rent || isNaN(Number(rent)) || Number(rent) < 0) {
      errors.rent = "Please enter a valid monthly rent amount (0 or greater).";
    }

    if (endDate && !isNaN(Date.parse(endDate)) && !isNaN(Date.parse(startDate))) {
      if (new Date(endDate) <= new Date(startDate)) {
        errors.endDate = "End date must be after the start date.";
      }
    }

    if (cycleDay && (isNaN(Number(cycleDay)) || Number(cycleDay) < 1 || Number(cycleDay) > 28)) {
      errors.cycleDay = "Billing cycle day must be between 1 and 28.";
    }

    // Validate services
    for (let i = 0; i < services.length; i++) {
      const s = services[i]!;
      if (!s.name.trim() || s.name.trim().length < 2) {
        errors.services = `Service #${i + 1} must have a valid name (at least 2 characters).`;
        break;
      }
      if (s.amount === "" || isNaN(Number(s.amount)) || Number(s.amount) < 0) {
        errors.services = `Service #${i + 1} ("${s.name}") must have a valid non-negative amount.`;
        break;
      }
    }

    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      const firstError = Object.values(errors)[0]!;
      setFormError(firstError);
      push({
        title: "Required fields missing or invalid",
        description: firstError,
        variant: "destructive"
      });
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }

    setBusy(true);
    try {
      const payload = {
        memberProfileId,
        roomId,
        bedId: bedId || null,
        startDate: new Date(startDate).toISOString(),
        endDate: endDate ? new Date(endDate).toISOString() : null,
        rentAmount: Number(rent),
        billingCycleDay: cycleDay ? Number(cycleDay) : 1,
        prorationBasis: proration,
        depositTotal: deposit ? Number(deposit) : 0,
        depositInstallments: depositInstallments ? Number(depositInstallments) : 1,
        noticeDays: noticeDays ? Number(noticeDays) : 30,
        autoRenew,
        escalationPercent: escalation ? Number(escalation) : null,
        services: services
          .filter((s) => s.name.trim().length >= 2 && s.amount !== "")
          .map((s) => ({
            serviceId: s.serviceId,
            name: s.name.trim(),
            amount: Number(s.amount),
            pricingModel: s.pricingModel,
            parkingSlotCode: s.parkingSlotCode || undefined,
            wifiSsid: s.wifiSsid || undefined
          }))
      };

      const res = await fetch("/api/leases", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      const body = (await res.json().catch(() => ({}))) as {
        id?: string;
        code?: string;
        message?: string;
        error?: string;
      };

      if (!res.ok || !body.id) {
        const errorDetail = body.message || body.error || `Server error (${res.status})`;
        setFormError(errorDetail);

        // Highlight related field if possible
        if (errorDetail.toLowerCase().includes("room")) {
          setFieldErrors((prev) => ({ ...prev, room: errorDetail }));
        } else if (errorDetail.toLowerCase().includes("member")) {
          setFieldErrors((prev) => ({ ...prev, member: errorDetail }));
        } else if (errorDetail.toLowerCase().includes("date") || errorDetail.toLowerCase().includes("term")) {
          setFieldErrors((prev) => ({ ...prev, startDate: errorDetail }));
        } else if (errorDetail.toLowerCase().includes("rent")) {
          setFieldErrors((prev) => ({ ...prev, rent: errorDetail }));
        }

        push({
          title: "Could not create lease",
          description: errorDetail,
          variant: "destructive"
        });
        window.scrollTo({ top: 0, behavior: "smooth" });
        return;
      }

      push({
        title: `Draft lease ${body.code} created successfully`,
        description: "Review terms, verify member KYC if needed, then activate to apply occupancy effects.",
        variant: "success"
      });
      router.push(`/leases/${body.id}`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "An unexpected error occurred while creating the lease.";
      setFormError(msg);
      push({ title: "Submission failed", description: msg, variant: "destructive" });
      window.scrollTo({ top: 0, behavior: "smooth" });
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="border-border/70 shadow-sm">
      <CardContent className="p-6">
        <form onSubmit={submit} className="space-y-6" noValidate>
          {/* Top Form Error Alert Banner */}
          {formError ? (
            <div className="flex items-start gap-3 rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive">
              <span className="text-lg font-bold">⚠️</span>
              <div className="space-y-1">
                <p className="font-semibold"><Tx>Could not create lease</Tx></p>
                <p className="text-xs opacity-90">{formError}</p>
              </div>
            </div>
          ) : null}

          {/* Section 1: Member Selection (Required) */}
          <section className="space-y-3 rounded-lg border bg-card p-4">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <p className="text-sm font-semibold flex items-center gap-1.5">
                  <Tx>1. Member Profile</Tx>
                  <span className="text-destructive font-bold">*</span>
                  <span className="text-xs font-normal text-muted-foreground">(Required)</span>
                </p>
                <p className="text-xs text-muted-foreground">
                  <Tx>Select the tenant profile for this lease. Prospects can be drafted; KYC is verified before activation.</Tx>
                </p>
              </div>
              {members.length > 5 ? (
                <Input
                  placeholder="Search member name..."
                  value={memberSearch}
                  onChange={(e) => setMemberSearch(e.target.value)}
                  className="h-8 w-44 text-xs"
                />
              ) : null}
            </div>

            <div className="space-y-1.5">
              <Select
                id="l-member"
                value={memberProfileId}
                onChange={(e) => {
                  setMemberProfileId(e.target.value);
                  clearFieldError("member");
                }}
                className={fieldErrors.member ? "border-destructive focus-visible:ring-destructive" : ""}
              >
                <option value=""><Tx>— Select member profile (Required) —</Tx></option>
                {filteredMembers.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.label}
                  </option>
                ))}
              </Select>
              {fieldErrors.member ? (
                <p className="text-xs font-medium text-destructive">{fieldErrors.member}</p>
              ) : null}

              {/* Selected Member Guidance Card */}
              {selectedMember ? (
                <div className="mt-2 rounded-md border bg-muted/40 p-3 text-xs space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-foreground">
                      {selectedMember.name || selectedMember.label}
                    </span>
                    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${
                      selectedMember.status === "active" ? "bg-emerald-500/20 text-emerald-700 dark:text-emerald-300" :
                      selectedMember.status === "verified" ? "bg-blue-500/20 text-blue-700 dark:text-blue-300" :
                      "bg-amber-500/20 text-amber-700 dark:text-amber-300"
                    }`}>
                      Status: {selectedMember.status || "prospect"}
                    </span>
                  </div>
                  {selectedMember.status === "prospect" ? (
                    <div className="text-amber-800 dark:text-amber-200">
                      <Tx>ℹ️ Member is currently in <strong>prospect</strong> status. You can create this draft lease now to reserve the room. Before activating the lease for move-in, complete KYC verification on the member profile.</Tx>
                    </div>
                  ) : (
                    <div className="text-emerald-800 dark:text-emerald-200">
                      <Tx>✅ Member is verified and ready for lease activation upon move-in.</Tx>
                    </div>
                  )}
                </div>
              ) : null}
            </div>
          </section>

          {/* Section 2: Room & Premises (Required) */}
          <section className="space-y-3 rounded-lg border bg-card p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="space-y-0.5">
                <p className="text-sm font-semibold flex items-center gap-1.5">
                  <Tx>2. Premises & Room</Tx>
                  <span className="text-destructive font-bold">*</span>
                  <span className="text-xs font-normal text-muted-foreground">(Required)</span>
                </p>
                <p className="text-xs text-muted-foreground">
                  <Tx>Pick the room or bed to assign. Drafting sets status to Reserved; activation sets status to Occupied.</Tx>
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Input
                  placeholder="Filter room # or property..."
                  value={roomSearch}
                  onChange={(e) => setRoomSearch(e.target.value)}
                  className="h-8 w-44 text-xs"
                />
                {rooms.length > 0 ? (
                  <span className="text-xs text-muted-foreground">{rooms.length} room(s)</span>
                ) : null}
              </div>
            </div>

            <div className="space-y-3">
              {/* Direct Room Dropdown */}
              <div className="space-y-1.5">
                <Label htmlFor="direct-room">Select Room <span className="text-destructive">*</span></Label>
                <Select
                  id="direct-room"
                  value={roomId}
                  onChange={(e) => pickRoom(e.target.value)}
                  className={`font-mono text-sm ${fieldErrors.room ? "border-destructive focus-visible:ring-destructive" : ""}`}
                >
                  <option value="">— Select Room (Required) —</option>
                  {filteredRooms.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.label} · [{r.status}] · {r.capacity} bed(s) · ${(r.basePriceMinor / 100).toFixed(2)}/mo
                    </option>
                  ))}
                </Select>
                {fieldErrors.room ? (
                  <p className="text-xs font-medium text-destructive">{fieldErrors.room}</p>
                ) : null}
              </div>

              {/* Hierarchy Filter Accordion / Helpers */}
              <div className="grid gap-2.5 sm:grid-cols-3 pt-1 text-xs">
                <div className="space-y-1">
                  <Label className="text-[11px] text-muted-foreground">Property filter</Label>
                  <Select
                    value={propertyId}
                    onChange={(e) => {
                      setPropertyId(e.target.value);
                      setBuildingId("");
                      setFloorId("");
                    }}
                    className="h-8 text-xs"
                  >
                    <option value="">(all properties)</option>
                    {properties.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.label}
                      </option>
                    ))}
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label className="text-[11px] text-muted-foreground">Building filter</Label>
                  <Select
                    value={buildingId}
                    onChange={(e) => {
                      setBuildingId(e.target.value);
                      setFloorId("");
                    }}
                    className="h-8 text-xs"
                  >
                    <option value="">(all buildings)</option>
                    {visibleBuildings.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.label}
                      </option>
                    ))}
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label className="text-[11px] text-muted-foreground">Floor filter</Label>
                  <Select
                    value={floorId}
                    onChange={(e) => setFloorId(e.target.value)}
                    className="h-8 text-xs"
                  >
                    <option value="">(all floors)</option>
                    {visibleFloors.map((f) => (
                      <option key={f.id} value={f.id}>
                        {f.label}
                      </option>
                    ))}
                  </Select>
                </div>
              </div>

              {/* Selected Room Details Card */}
              {selectedRoom ? (
                <div className="mt-2 rounded-md border bg-muted/40 p-3 space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                    <span className="font-semibold text-foreground">
                      Premises: {selectedRoom.label}
                    </span>
                    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase ${
                      selectedRoom.status === "vacant" ? "bg-emerald-500/20 text-emerald-700 dark:text-emerald-300" :
                      selectedRoom.status === "reserved" ? "bg-amber-500/20 text-amber-700 dark:text-amber-300" :
                      "bg-blue-500/20 text-blue-700 dark:text-blue-300"
                    }`}>
                      Current Status: {selectedRoom.status}
                    </span>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="space-y-1.5">
                      <Label htmlFor="l-bed" className="text-xs">Bed Assignment (Co-living)</Label>
                      <Select id="l-bed" value={bedId} onChange={(e) => setBedId(e.target.value)} className="h-8 text-xs">
                        <option value="">
                          Entire room {selectedRoom.wholeRoomFree ? "(free)" : "(taken)"}
                        </option>
                        {selectedRoom.beds.map((b) => (
                          <option key={b.id} value={b.id} disabled={b.taken}>
                            {b.label} {b.taken ? "(already leased)" : "(available)"}
                          </option>
                        ))}
                      </Select>
                    </div>
                    <div className="flex flex-col justify-end text-xs text-muted-foreground space-y-0.5">
                      <p><Tx>Capacity: </Tx><strong className="text-foreground">{selectedRoom.capacity} person(s)</strong></p>
                      <p><Tx>Base list price: </Tx><strong className="text-foreground">${(selectedRoom.basePriceMinor / 100).toFixed(2)}/mo</strong></p>
                    </div>
                  </div>
                </div>
              ) : null}
            </div>
          </section>

          {/* Section 3: Terms & Rent (Required) */}
          <section className="space-y-3 rounded-lg border bg-card p-4">
            <p className="text-sm font-semibold flex items-center gap-1.5">
              <Tx>3. Term & Financial Terms</Tx>
            </p>
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="space-y-1.5">
                <Label htmlFor="l-start">
                  Start date <span className="text-destructive font-bold">*</span>
                </Label>
                <Input
                  id="l-start"
                  type="date"
                  value={startDate}
                  onChange={(e) => {
                    setStartDate(e.target.value);
                    clearFieldError("startDate");
                  }}
                  className={fieldErrors.startDate ? "border-destructive focus-visible:ring-destructive" : ""}
                  required
                />
                {fieldErrors.startDate ? (
                  <p className="text-xs font-medium text-destructive">{fieldErrors.startDate}</p>
                ) : null}
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="l-end">End date (optional)</Label>
                <Input
                  id="l-end"
                  type="date"
                  value={endDate}
                  onChange={(e) => {
                    setEndDate(e.target.value);
                    clearFieldError("endDate");
                  }}
                  min={startDate}
                  className={fieldErrors.endDate ? "border-destructive focus-visible:ring-destructive" : ""}
                />
                {fieldErrors.endDate ? (
                  <p className="text-xs font-medium text-destructive">{fieldErrors.endDate}</p>
                ) : (
                  <p className="text-[11px] text-muted-foreground">Leave blank for open-ended</p>
                )}
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="l-rent">
                  Rent / month ($) <span className="text-destructive font-bold">*</span>
                </Label>
                <Input
                  id="l-rent"
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="e.g. 350.00"
                  value={rent}
                  onChange={(e) => {
                    setRent(e.target.value);
                    clearFieldError("rent");
                  }}
                  className={fieldErrors.rent ? "border-destructive focus-visible:ring-destructive" : ""}
                  required
                />
                {fieldErrors.rent ? (
                  <p className="text-xs font-medium text-destructive">{fieldErrors.rent}</p>
                ) : null}
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="l-cycle">Billing cycle day (1–28)</Label>
                <Input
                  id="l-cycle"
                  type="number"
                  min="1"
                  max="28"
                  value={cycleDay}
                  onChange={(e) => {
                    setCycleDay(e.target.value);
                    clearFieldError("cycleDay");
                  }}
                  className={fieldErrors.cycleDay ? "border-destructive focus-visible:ring-destructive" : ""}
                />
                {fieldErrors.cycleDay ? (
                  <p className="text-xs font-medium text-destructive">{fieldErrors.cycleDay}</p>
                ) : null}
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="l-proration">Proration basis</Label>
                <Select id="l-proration" value={proration} onChange={(e) => setProration(e.target.value)}>
                  <option value="calendar"><Tx>Calendar days</Tx></option>
                  <option value="thirty_day"><Tx>30-day month</Tx></option>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="l-esc">Escalation % / year (optional)</Label>
                <Input
                  id="l-esc"
                  type="number"
                  step="0.1"
                  min="0"
                  max="50"
                  placeholder="e.g. 5"
                  value={escalation}
                  onChange={(e) => setEscalation(e.target.value)}
                />
              </div>
            </div>
          </section>

          {/* Section 4: Deposit & Notice */}
          <section className="space-y-3 rounded-lg border bg-card p-4">
            <p className="text-sm font-semibold"><Tx>4. Deposit & Notice Policy</Tx></p>
            <div className="grid gap-3 sm:grid-cols-4">
              <div className="space-y-1.5">
                <Label htmlFor="l-dep">Deposit total ($)</Label>
                <Input
                  id="l-dep"
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="0.00"
                  value={deposit}
                  onChange={(e) => setDeposit(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="l-depi">Installments</Label>
                <Input
                  id="l-depi"
                  type="number"
                  min="1"
                  max="12"
                  value={depositInstallments}
                  onChange={(e) => setDepositInstallments(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="l-notice">Notice days</Label>
                <Input
                  id="l-notice"
                  type="number"
                  min="0"
                  max="180"
                  value={noticeDays}
                  onChange={(e) => setNoticeDays(e.target.value)}
                />
              </div>
              <label className="flex items-center gap-2 pt-6 text-sm cursor-pointer">
                <input
                  type="checkbox"
                  className="h-4 w-4 rounded border-input text-primary focus:ring-primary"
                  checked={autoRenew}
                  onChange={(e) => setAutoRenew(e.target.checked)}
                />
                <span><Tx>Auto-renew term</Tx></span>
              </label>
            </div>
          </section>

          {/* Section 5: Optional Monthly Add-on Services & Utilities */}
          <section className="space-y-3 rounded-lg border bg-muted/20 p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="text-sm font-semibold"><Tx>5. Optional Services & Utilities (Monthly Add-ons)</Tx></p>
                <p className="text-xs text-muted-foreground">
                  <Tx>Assign WiFi, Parking, Laundry plans or custom services. Automatically included in monthly recurring invoices.</Tx>
                </p>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {catalog.map((c) => (
                  <Button
                    key={c.id}
                    type="button"
                    variant="outline"
                    size="sm"
                    className="text-xs"
                    onClick={() => addCatalogService(c)}
                  >
                    + {c.name} (${(c.unitPriceMinor / 100).toFixed(2)}{c.pricingModel === "fixed_monthly" ? "/mo" : c.unitLabel ? `/${c.unitLabel}` : ""})
                  </Button>
                ))}
                <Button type="button" variant="secondary" size="sm" className="text-xs" onClick={addCustomService}>
                  + Custom service
                </Button>
              </div>
            </div>

            {fieldErrors.services ? (
              <p className="text-xs font-medium text-destructive">{fieldErrors.services}</p>
            ) : null}

            {services.length === 0 ? (
              <p className="py-2 text-xs italic text-muted-foreground">
                <Tx>No optional services assigned. Click the buttons above to assign WiFi, Parking, Laundry, etc.</Tx>
              </p>
            ) : (
              <div className="space-y-2 pt-2">
                {services.map((s, i) => {
                  const isParking = s.name.toLowerCase().includes("parking") || s.serviceId === catalog.find((c) => c.code === "PARK")?.id;
                  const isWifi = s.name.toLowerCase().includes("wifi") || s.serviceId === catalog.find((c) => c.code === "WIFI")?.id;

                  return (
                    <div key={i} className="grid items-center gap-2 rounded-md border bg-background p-2.5 sm:grid-cols-[1fr_120px_130px_auto]">
                      <div className="space-y-1">
                        <Input
                          placeholder="Service name (e.g. WiFi, Parking, Laundry)"
                          value={s.name}
                          onChange={(e) => setService(i, { name: e.target.value })}
                          required
                        />
                        {isParking && availableSlots.length > 0 ? (
                          <div className="flex items-center gap-1.5 pt-1 text-xs text-muted-foreground">
                            <span>Slot:</span>
                            <Select
                              value={s.parkingSlotCode ?? ""}
                              onChange={(e) => setService(i, { parkingSlotCode: e.target.value })}
                              className="h-7 text-xs"
                            >
                              <option value="">(any / no specific slot)</option>
                              {availableSlots.map((slot) => (
                                <option key={slot.id} value={slot.code}>
                                  {slot.code} (${(slot.monthlyFeeMinor / 100).toFixed(2)}/mo)
                                </option>
                              ))}
                            </Select>
                          </div>
                        ) : null}
                        {isWifi && availableWifi.length > 0 ? (
                          <div className="flex items-center gap-1.5 pt-1 text-xs text-muted-foreground">
                            <span>WiFi SSID:</span>
                            <Select
                              value={s.wifiSsid ?? ""}
                              onChange={(e) => setService(i, { wifiSsid: e.target.value })}
                              className="h-7 text-xs"
                            >
                              <option value="">(no specific SSID)</option>
                              {availableWifi.map((w) => (
                                <option key={w.id} value={w.ssid}>
                                  {w.ssid} {w.speedLabel ? `(${w.speedLabel})` : ""}
                                </option>
                              ))}
                            </Select>
                          </div>
                        ) : null}
                      </div>

                      <div>
                        <Input
                          placeholder="Amount / mo"
                          type="number"
                          step="0.01"
                          min="0"
                          value={s.amount}
                          onChange={(e) => setService(i, { amount: e.target.value })}
                          required
                        />
                      </div>

                      <div>
                        <Select
                          value={s.pricingModel}
                          onChange={(e) => setService(i, { pricingModel: e.target.value })}
                          className="text-xs"
                        >
                          <option value="fixed_monthly">Fixed monthly</option>
                          <option value="per_use">Per use</option>
                          <option value="metered">Metered</option>
                        </Select>
                      </div>

                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="text-destructive hover:bg-destructive/10"
                        onClick={() => setServices((prev) => prev.filter((_, idx) => idx !== i))}
                      >
                        ✕
                      </Button>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Monthly Breakdown Summary Card */}
            <div className="mt-3 flex flex-wrap items-center justify-between rounded-md border border-primary/20 bg-primary/5 p-3 text-sm">
              <div className="space-y-0.5">
                <span className="font-semibold text-primary"><Tx>Estimated Monthly Invoice</Tx></span>
                <p className="text-xs text-muted-foreground">
                  <Tx>Base Rent (${(Number(rent) || 0).toFixed(2)}) + Monthly Add-ons (${monthlyServicesTotal.toFixed(2)})</Tx>
                </p>
              </div>
              <div className="text-right">
                <span className="text-xl font-bold text-primary tabular-nums">
                  ${monthlyTotalEstimate.toFixed(2)}
                </span>
                <span className="text-xs text-muted-foreground"><Tx> / month</Tx></span>
              </div>
            </div>
          </section>

          {/* Action Buttons */}
          <div className="flex items-center justify-between pt-2">
            <p className="text-xs text-muted-foreground">
              <span className="text-destructive font-bold">*</span> Indicates mandatory field
            </p>
            <div className="flex gap-2">
              <Button type="button" variant="outline" onClick={() => router.push("/leases")} disabled={busy}>
                Cancel
              </Button>
              <Button type="submit" variant="success" disabled={busy} className="min-w-[160px]">
                {busy ? "Creating Draft Lease…" : "Create Draft Lease"}
              </Button>
            </div>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
