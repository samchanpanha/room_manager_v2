"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog } from "@/components/ui/dialog";
import { Input, Label, Select, Textarea } from "@/components/ui/input";
import { useToast } from "@/components/toast";
import { formatMinor } from "@/lib/money";
import { ROOM_TRANSITIONS, type RoomStatus } from "@/lib/rooms/status";
import { cn } from "@/lib/utils";
import { Tx } from "@/components/i18n-text";

interface RoomView {
  id: string;
  number: string;
  type: string;
  status: RoomStatus;
  basePriceMinor: number;
  capacity: number;
  notes: string | null;
  beds: string[];
}

interface FloorView {
  id: string;
  name: string;
  level: number;
  rooms: RoomView[];
}

interface BuildingView {
  id: string;
  name: string;
  floors: FloorView[];
}

const STATUS_STYLES: Record<RoomStatus, string> = {
  vacant: "border-l-muted-foreground/40",
  reserved: "border-l-blue-500",
  occupied: "border-l-success",
  cleaning: "border-l-warning",
  maintenance: "border-l-destructive"
};

const STATUS_VARIANT: Record<RoomStatus, "secondary" | "info" | "success" | "warning" | "destructive"> = {
  vacant: "secondary",
  reserved: "info",
  occupied: "success",
  cleaning: "warning",
  maintenance: "destructive"
};

async function api(url: string, method: string, body?: unknown): Promise<{ ok: boolean; message?: string }> {
  const res = await fetch(url, {
    method,
    headers: { "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined
  });
  if (res.ok) return { ok: true };
  const data = (await res.json().catch(() => ({}))) as { message?: string };
  return { ok: false, message: data.message };
}

export function BuildingSection({
  building,
  canCreate,
  canUpdate
}: {
  building: BuildingView;
  canCreate: boolean;
  canUpdate: boolean;
}) {
  const totalRooms = building.floors.reduce((s, f) => s + f.rooms.length, 0);
  const occupied = building.floors.reduce((s, f) => s + f.rooms.filter((r) => r.status === "occupied").length, 0);
  const [addFloor, setAddFloor] = useState(false);

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <div className="flex items-center gap-3">
          <CardTitle className="text-base">{building.name}</CardTitle>
          <Badge variant={occupied > 0 ? "success" : "secondary"}>
            {occupied}/{totalRooms} occupied
          </Badge>
        </div>
        {canCreate ? (
          <Button size="sm" variant="outline" onClick={() => setAddFloor(true)}>
            + Add floor
          </Button>
        ) : null}
      </CardHeader>
      <CardContent className="space-y-5">
        {building.floors.length === 0 ? (
          <p className="text-sm text-muted-foreground"><Tx>No floors yet — add a floor, then use the bulk room wizard.</Tx></p>
        ) : (
          building.floors.map((floor) => <FloorBlock key={floor.id} floor={floor} canCreate={canCreate} canUpdate={canUpdate} />)
        )}
      </CardContent>
      <AddFloorDialog open={addFloor} onClose={() => setAddFloor(false)} buildingId={building.id} />
    </Card>
  );
}

function FloorBlock({ floor, canCreate, canUpdate }: { floor: FloorView; canCreate: boolean; canUpdate: boolean }) {
  const [wizard, setWizard] = useState(false);
  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <p className="text-sm font-medium text-muted-foreground">
          {floor.name} <span className="text-xs">(level {floor.level}) · {floor.rooms.length} rooms</span>
        </p>
        {canCreate ? (
          <Button size="sm" variant="ghost" onClick={() => setWizard(true)}>
            + Bulk add rooms
          </Button>
        ) : null}
      </div>
      {floor.rooms.length === 0 ? (
        <p className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground"><Tx>No rooms on this floor yet.</Tx></p>
      ) : (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
          {floor.rooms.map((room) => <RoomCard key={room.id} room={room} canUpdate={canUpdate} />)}
        </div>
      )}
      <BulkRoomsDialog open={wizard} onClose={() => setWizard(false)} floorId={floor.id} floorName={floor.name} />
    </div>
  );
}

function RoomCard({ room, canUpdate }: { room: RoomView; canUpdate: boolean }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className={cn(
          "w-full rounded-lg border border-l-4 bg-card p-3 text-left shadow-sm transition-shadow hover:shadow-md",
          STATUS_STYLES[room.status]
        )}
      >
        <div className="flex items-center justify-between">
          <span className="font-semibold">{room.number}</span>
          <Badge variant={STATUS_VARIANT[room.status]} className="px-1.5 text-[10px]">
            {room.status}
          </Badge>
        </div>
        <p className="mt-1 text-xs text-muted-foreground">{room.type}</p>
        <p className="mt-0.5 text-xs tabular-nums text-muted-foreground">
          {formatMinor(room.basePriceMinor)} · {room.beds.length || room.capacity} bed{room.beds.length === 1 ? "" : "s"}
        </p>
      </button>
      <RoomDialog room={room} open={open} onClose={() => setOpen(false)} canUpdate={canUpdate} />
    </>
  );
}

function RoomDialog({ room, open, onClose, canUpdate }: { room: RoomView; open: boolean; onClose: () => void; canUpdate: boolean }) {
  const router = useRouter();
  const { push } = useToast();
  const [busy, setBusy] = useState(false);
  const nexts = ROOM_TRANSITIONS[room.status];

  async function transition(to: RoomStatus) {
    let reason: string | undefined;
    if (to === "maintenance") {
      reason = window.prompt("Reason for maintenance (required):") ?? undefined;
      if (!reason) return;
    }
    setBusy(true);
    const r = await api(`/api/rooms/${room.id}/status`, "POST", { to, reason });
    setBusy(false);
    if (!r.ok) {
      push({ title: "Transition rejected", description: r.message, variant: "destructive" });
      return;
    }
    push({ title: `Room ${room.number} → ${to}`, variant: "success" });
    onClose();
    router.refresh();
  }

  async function saveDetails(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    setBusy(true);
    const r = await api(`/api/rooms/${room.id}`, "PATCH", {
      number: form.get("number"),
      type: form.get("type"),
      basePrice: Number(form.get("basePrice")),
      capacity: Number(form.get("capacity")),
      notes: form.get("notes") || null
    });
    setBusy(false);
    if (!r.ok) {
      push({ title: "Update failed", description: r.message, variant: "destructive" });
      return;
    }
    push({ title: "Room updated", variant: "success" });
    onClose();
    router.refresh();
  }

  return (
    <Dialog open={open} onClose={onClose} title={`Room ${room.number}`} description={`${room.type} · ${room.beds.length || room.capacity} bed(s)`}>
      <div className="space-y-5">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant={STATUS_VARIANT[room.status]}>{room.status}</Badge>
          <Badge variant="outline">{formatMinor(room.basePriceMinor)} / month</Badge>
          {room.notes ? <Badge variant="outline">{room.notes}</Badge> : null}
        </div>

        {canUpdate && nexts.length > 0 ? (
          <div>
            <p className="mb-1.5 text-sm font-medium"><Tx>Status transitions</Tx></p>
            <div className="flex flex-wrap gap-2">
              {nexts.map((to) => (
                <Button key={to} size="sm" variant="outline" disabled={busy} onClick={() => transition(to)}>
                  → {to}
                </Button>
              ))}
            </div>
            <p className="mt-1.5 text-xs text-muted-foreground">
              Allowed: {room.status} → [{nexts.join(", ")}] · enforced server-side, every change audited
            </p>
          </div>
        ) : null}

        {canUpdate ? (
          <form onSubmit={saveDetails} className="space-y-3 border-t pt-4">
            <p className="text-sm font-medium"><Tx>Edit details</Tx></p>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor={`r-num-${room.id}`}>Number</Label>
                <Input id={`r-num-${room.id}`} name="number" defaultValue={room.number} required />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor={`r-type-${room.id}`}>Type</Label>
                <Select id={`r-type-${room.id}`} name="type" defaultValue={room.type}>
                  {["STANDARD", "DELUXE", "STUDIO", "SUITE"].map((tp) => (
                    <option key={tp} value={tp}>
                      {tp}
                    </option>
                  ))}
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor={`r-price-${room.id}`}>Base price / month (major units)</Label>
                <Input
                  id={`r-price-${room.id}`}
                  name="basePrice"
                  type="number"
                  step="0.01"
                  min="0"
                  defaultValue={(room.basePriceMinor / 100).toFixed(2)}
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor={`r-cap-${room.id}`}>Capacity (beds)</Label>
                <Input id={`r-cap-${room.id}`} name="capacity" type="number" min="1" max="8" defaultValue={room.capacity} required />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor={`r-notes-${room.id}`}>Notes</Label>
              <Textarea id={`r-notes-${room.id}`} name="notes" rows={2} defaultValue={room.notes ?? ""} />
            </div>
            <div className="flex justify-end">
              <Button type="submit" size="sm" disabled={busy}>
                {busy ? "Saving…" : "Save changes"}
              </Button>
            </div>
          </form>
        ) : null}
      </div>
    </Dialog>
  );
}

function AddFloorDialog({ open, onClose, buildingId }: { open: boolean; onClose: () => void; buildingId: string }) {
  const router = useRouter();
  const { push } = useToast();
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    setBusy(true);
    const r = await api("/api/floors", "POST", {
      buildingId,
      name: form.get("name"),
      level: Number(form.get("level"))
    });
    setBusy(false);
    if (!r.ok) {
      push({ title: "Could not add floor", description: r.message, variant: "destructive" });
      return;
    }
    push({ title: "Floor added", variant: "success" });
    onClose();
    router.refresh();
  }

  return (
    <Dialog open={open} onClose={onClose} title="Add floor">
      <form onSubmit={submit} className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="f-name">Name</Label>
            <Input id="f-name" name="name" placeholder="Floor 4" required minLength={1} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="f-level">Level</Label>
            <Input id="f-level" name="level" type="number" defaultValue={1} required />
          </div>
        </div>
        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={busy}>
            {busy ? "Adding…" : "Add floor"}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}

function BulkRoomsDialog({ open, onClose, floorId, floorName }: { open: boolean; onClose: () => void; floorId: string; floorName: string }) {
  const router = useRouter();
  const { push } = useToast();
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    setBusy(true);
    const r = await api("/api/rooms/bulk", "POST", {
      floorId,
      prefix: form.get("prefix"),
      start: Number(form.get("start")),
      count: Number(form.get("count")),
      beds: Number(form.get("beds")),
      type: form.get("type"),
      basePrice: Number(form.get("basePrice"))
    });
    setBusy(false);
    if (!r.ok) {
      push({ title: "Bulk create failed", description: r.message, variant: "destructive" });
      return;
    }
    push({ title: "Rooms created", variant: "success" });
    onClose();
    router.refresh();
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={`Bulk add rooms — ${floorName}`}
      description="Creates rooms + beds in one go. Numbers are zero-padded: PREFIX-01, PREFIX-02, …"
    >
      <form onSubmit={submit} className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="b-prefix">Prefix</Label>
            <Input id="b-prefix" name="prefix" placeholder="A4" maxLength={8} required />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="b-start">Start number</Label>
            <Input id="b-start" name="start" type="number" min="1" defaultValue={1} required />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="b-count">How many rooms</Label>
            <Input id="b-count" name="count" type="number" min="1" max="40" defaultValue={4} required />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="b-beds">Beds per room</Label>
            <Input id="b-beds" name="beds" type="number" min="1" max="8" defaultValue={1} required />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="b-type">Room type</Label>
            <Select id="b-type" name="type" defaultValue="STANDARD">
              {["STANDARD", "DELUXE", "STUDIO", "SUITE"].map((tp) => (
                <option key={tp} value={tp}>
                  {tp}
                </option>
              ))}
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="b-price">Base price / month (major)</Label>
            <Input id="b-price" name="basePrice" type="number" step="0.01" min="0" defaultValue="250.00" required />
          </div>
        </div>
        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={busy}>
            {busy ? "Creating…" : "Create rooms"}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}

// Re-export a small form used by the parent page (client boundary keeps page a server component).
export function AddBuildingForm({ propertyId }: { propertyId: string }) {
  const router = useRouter();
  const { push } = useToast();
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    setBusy(true);
    const r = await api("/api/buildings", "POST", { propertyId, name: form.get("name"), address: form.get("address") || undefined });
    setBusy(false);
    if (!r.ok) {
      push({ title: "Could not add building", description: r.message, variant: "destructive" });
      return;
    }
    push({ title: "Building added", variant: "success" });
    router.refresh();
  }

  return (
    <form onSubmit={submit} className="flex flex-wrap items-end gap-3">
      <div className="min-w-48 flex-1 space-y-1.5">
        <Label htmlFor="bldg-name">Building name</Label>
        <Input id="bldg-name" name="name" placeholder="Building B" required minLength={1} />
      </div>
      <div className="min-w-48 flex-1 space-y-1.5">
        <Label htmlFor="bldg-addr">Address (optional)</Label>
        <Input id="bldg-addr" name="address" placeholder="Same street" />
      </div>
      <Button type="submit" disabled={busy}>
        {busy ? "Adding…" : "Add building"}
      </Button>
    </form>
  );
}
