"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EmptyState } from "@/components/ui/misc";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { useToast } from "@/components/toast";
import { formatMinor } from "@/lib/money";
import { cn } from "@/lib/utils";
import { Tx } from "@/components/i18n-text";

type Tab = "bookings" | "modules" | "rates";

interface ModuleRow {
  id: string;
  name: string;
  slug: string;
  billingStrategy: string;
  minDurationMinutes: number;
  maxDurationMinutes: number;
  defaultDepositMinor: number;
  minGuests: number;
  maxGuests: number;
  sortOrder: number;
  isActive: boolean;
  propertyId: string | null;
  _count?: { bookings: number; rates: number };
}

interface RateRow {
  id: string;
  moduleId: string;
  propertyId: string | null;
  roomType: string | null;
  effectiveFrom: string;
  effectiveThrough: string | null;
  toMinutes: number;
  priceMinor: number;
  isActive: boolean;
  module?: { name: string };
}

interface BookingRow {
  id: string;
  code: string;
  moduleId: string;
  roomId: string;
  propertyId: string;
  guestName: string;
  guestPhone: string | null;
  guestIdNumber: string | null;
  checkIn: string;
  checkOut: string;
  guests: number;
  status: string;
  priceSnapshotMinor: number;
  dayPriceMinor: number;
  depositMinor: number;
  posMode: string;
  notes: string | null;
  checkedOutAt: string | null;
  memberProfileId: string;
  room?: { number: string; type: string };
  module?: { name: string };
  tabInvoice?: { id: string; code: string; status: string; totalMinor: number; amountDueMinor: number } | null;
}

interface RoomRow {
  id: string;
  number: string;
  type: string;
  capacity: number;
  status: string;
  basePriceMinor: number;
  propertyId: string;
  propertyCode: string;
}

interface PropertyRow {
  id: string;
  code: string;
}

const STATUS_VARIANT: Record<string, "default" | "secondary" | "outline" | "destructive" | "success"> = {
  requested: "secondary",
  confirmed: "outline",
  checked_in: "default",
  checked_out: "success",
  no_show: "destructive",
  cancelled: "outline",
  void: "destructive"
};

const STATUS_LABEL: Record<string, string> = {
  requested: "Requested",
  confirmed: "Confirmed",
  checked_in: "Checked in",
  checked_out: "Checked out",
  no_show: "No-show",
  cancelled: "Cancelled",
  void: "Void"
};

interface BookingDetail extends BookingRow {
  module?: { name: string };
  tabInvoice?: (NonNullable<BookingRow["tabInvoice"]> & { items?: { id: string; name: string; amountMinor: number }[] }) | null;
}

interface PriceBucket {
  toMinutes: number;
  priceMinor: number;
}

interface StayQuote {
  minutes: number;
  buckets: PriceBucket[];
  totalMinor: number;
  dayPriceMinor: number;
}

function fmt(d?: string | null): string {
  if (!d) return "—";
  return new Date(d).toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

function duration(minutes: number): string {
  if (minutes % 1440 === 0) return `${minutes / 1440}d`;
  if (minutes % 60 === 0) return `${minutes / 60}h`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

async function send(url: string, method: string, body: unknown): Promise<{ ok: boolean; message?: string; data?: unknown }> {
  const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const data = (await res.json().catch(() => ({}))) as { message?: string };
  return { ok: res.ok, message: data.message, data };
}

interface Props {
  modules: ModuleRow[];
  rates: RateRow[];
  bookings: BookingRow[];
  rooms: RoomRow[];
  properties: PropertyRow[];
  canWrite: boolean;
}

export function StayManager({ modules, rates, bookings, rooms, properties, canWrite }: Props) {
  const router = useRouter();
  const { push } = useToast();
  const [tab, setTab] = useState<Tab>("bookings");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [showNew, setShowNew] = useState(false);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [moduleDialog, setModuleDialog] = useState<{ module?: ModuleRow } | null>(null);
  const [rateDialog, setRateDialog] = useState<{ rate?: RateRow; moduleId?: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [rateModuleFilter, setRateModuleFilter] = useState("all");

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return bookings.filter((b) => {
      if (statusFilter !== "all" && b.status !== statusFilter) return false;
      if (q && !`${b.code} ${b.guestName} ${b.room?.number} ${b.module?.name}`.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [bookings, search, statusFilter]);

  const activeBookings = bookings.filter((b) => ["requested", "confirmed", "checked_in"].includes(b.status));
  const grossMinor = bookings.filter((b) => b.status === "checked_out").reduce((s, b) => s + b.priceSnapshotMinor, 0);

  async function runAction(id: string, action: string, opts: Record<string, unknown> = {}) {
    setBusy(true);
    const r = await send(`/api/stay/bookings/${id}/actions`, "POST", { action, ...opts });
    setBusy(false);
    push(
      r.ok
        ? { title: `${action} done`, variant: "success" }
        : { title: "Action failed", description: r.message, variant: "destructive" }
    );
    if (r.ok) router.refresh();
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="inline-flex rounded-lg border bg-card p-1 text-sm">
          {(
            [
              ["bookings", `Bookings (${activeBookings.length} active)`],
              ["modules", "Modules"],
              ["rates", "Rates"]
            ] as [Tab, string][]
          ).map(([k, label]) => (
            <button
              key={k}
              onClick={() => setTab(k)}
              className={cn("rounded-md px-3 py-1.5 font-medium", tab === k ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted")}
            >
              {label}
            </button>
          ))}
        </div>
        {canWrite ? (
          <Button onClick={() => setShowNew(true)} disabled={modules.length === 0}>
            New booking
          </Button>
        ) : null}
      </div>

      {tab === "bookings" ? (
        <BookingsTable
          bookings={filtered}
          search={search}
          setSearch={setSearch}
          statusFilter={statusFilter}
          setStatusFilter={setStatusFilter}
          onDetail={setDetailId}
          canWrite={canWrite}
          busy={busy}
          runAction={runAction}
          grossMinor={grossMinor}
        />
      ) : tab === "modules" ? (
        <ModulesTable
          modules={modules}
          rates={rates}
          canWrite={canWrite}
          onEdit={(m) => setModuleDialog({ module: m })}
          onCreate={() => setModuleDialog({})}
        />
      ) : (
        <RatesTable
          modules={modules}
          rates={rates}
          properties={properties}
          filter={rateModuleFilter}
          setFilter={setRateModuleFilter}
          canWrite={canWrite}
          onEdit={(r) => setRateDialog({ rate: r })}
          onCreate={(mid) => setRateDialog({ moduleId: mid })}
        />
      )}

      {showNew ? (
        <NewBookingDialog
          modules={modules}
          rooms={rooms}
          onClose={() => setShowNew(false)}
          onDone={() => {
            setShowNew(false);
            router.refresh();
          }}
        />
      ) : null}

      {detailId ? <DetailDialog id={detailId} onClose={() => setDetailId(null)} runAction={runAction} busy={busy} /> : null}

      {moduleDialog ? <ModuleDialog existing={moduleDialog.module} onClose={() => setModuleDialog(null)} /> : null}

      {rateDialog ? (
        <RateDialog
          modules={modules}
          properties={properties}
          existing={rateDialog.rate}
          presetModuleId={rateDialog.moduleId}
          onClose={() => setRateDialog(null)}
        />
      ) : null}
    </div>
  );
}

// ─────────────────────────────────── Bookings ───────────────────────────────────

function BookingsTable({
  bookings,
  search,
  setSearch,
  statusFilter,
  setStatusFilter,
  onDetail,
  canWrite,
  busy,
  runAction,
  grossMinor
}: {
  bookings: BookingRow[];
  search: string;
  setSearch: (v: string) => void;
  statusFilter: string;
  setStatusFilter: (v: string) => void;
  onDetail: (id: string) => void;
  canWrite: boolean;
  busy: boolean;
  runAction: (id: string, action: string, opts?: Record<string, unknown>) => Promise<void>;
  grossMinor: number;
}) {
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search code / guest / room…" className="max-w-xs" />
        <SearchableSelect
          value={statusFilter}
          onChange={setStatusFilter}
          options={[
            { value: "all", label: "All statuses" },
            ...Object.entries(STATUS_LABEL).map(([k, v]) => ({ value: k, label: v }))
          ]}
          className="rounded-md border bg-card px-2 py-2 text-sm"
          placeholder="All statuses"
        />
        <span className="ml-auto text-sm text-muted-foreground">
          <Tx>Completed revenue: </Tx><span className="font-medium">{formatMinor(grossMinor)}</span>
        </span>
      </div>

      {bookings.length === 0 ? (
        <EmptyState title="No bookings yet" hint="Create one — pick a room, an interval, and the module sets the price." />
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Code</TableHead>
              <TableHead>Guest</TableHead>
              <TableHead>Room</TableHead>
              <TableHead>Interval</TableHead>
              <TableHead>Module</TableHead>
              <TableHead className="text-right">Total</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {bookings.map((b) => (
              <TableRow key={b.id}>
                <TableCell className="font-medium">{b.code}</TableCell>
                <TableCell>
                  {b.guestName}
                  {b.guestPhone ? <div className="text-xs text-muted-foreground">{b.guestPhone}</div> : null}
                </TableCell>
                <TableCell>
                  {b.room?.number}
                  {b.module ? <div className="text-xs text-muted-foreground">{b.module.name}</div> : null}
                </TableCell>
                <TableCell className="whitespace-nowrap">
                  {fmt(b.checkIn)} → {fmt(b.checkOut)}
                  {b.posMode === "tab" ? <div className="text-xs text-muted-foreground"><Tx>POS tab</Tx></div> : null}
                </TableCell>
                <TableCell>{duration((new Date(b.checkOut).getTime() - new Date(b.checkIn).getTime()) / 60000)}</TableCell>
                <TableCell className="text-right tabular-nums">
                  {formatMinor(b.priceSnapshotMinor)}
                  {b.depositMinor > 0 ? <div className="text-xs text-muted-foreground">+{formatMinor(b.depositMinor)} <Tx>deposit</Tx></div> : null}
                </TableCell>
                <TableCell>
                  <Badge variant={STATUS_VARIANT[b.status] ?? "outline"}>{STATUS_LABEL[b.status] ?? b.status}</Badge>
                  {b.tabInvoice && b.tabInvoice.amountDueMinor > 0 ? (
                    <div className="mt-1 text-xs text-destructive"><Tx>due </Tx>{formatMinor(b.tabInvoice.amountDueMinor)}</div>
                  ) : null}
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-1">
                    <Button variant="outline" size="sm" onClick={() => onDetail(b.id)}>
                      Open
                    </Button>
                    {canWrite && b.status === "requested" ? (
                      <Button size="sm" disabled={busy} onClick={() => runAction(b.id, "confirm")}>
                        Confirm
                      </Button>
                    ) : null}
                    {canWrite && b.status === "confirmed" ? (
                      <Button size="sm" disabled={busy} onClick={() => runAction(b.id, "checkin")}>
                        Check in
                      </Button>
                    ) : null}
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}

function DetailDialog({
  id,
  onClose,
  runAction,
  busy
}: {
  id: string;
  onClose: () => void;
  runAction: (id: string, action: string, opts?: Record<string, unknown>) => Promise<void>;
  busy: boolean;
}) {
  const [payMethod, setPayMethod] = useState("cash");
  const [depositMethod, setDepositMethod] = useState("cash");
  const [extendTo, setExtendTo] = useState("");
  const [reason, setReason] = useState("");
  const [data, setData] = useState<BookingDetail | null>(null);

  useEffect(() => {
    setData(null);
    setReason("");
    fetch(`/api/stay/bookings/${id}`)
      .then((r) => r.json())
      .then((d) => setData(d.booking))
      .catch(() => setData(null));
  }, [id]);

  if (!data) return <Dialog open onClose={onClose} title="Booking"> <EmptyState title="Loading…" /></Dialog>;

  const active = ["requested", "confirmed", "checked_in"].includes(data.status);

  return (
    <Dialog open onClose={onClose} title={`Booking ${data.code}`} description={data.room ? `Room ${data.room.number} · ${data.module?.name ?? ""}` : undefined} wide>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Guest">{data.guestName}{data.guestPhone ? <span className="text-muted-foreground"> · {data.guestPhone}</span> : null}</Field>
        <Field label="Interval">
          {fmt(data.checkIn)} → {fmt(data.checkOut)} ({duration((new Date(data.checkOut).getTime() - new Date(data.checkIn).getTime()) / 60000)})
        </Field>
        <Field label="Guests">{data.guests}</Field>
        <Field label="POS mode">{data.posMode === "tab" ? "Shared tab (room-charge)" : "Direct settlement"}</Field>
        <Field label="Total">{formatMinor(data.priceSnapshotMinor)}</Field>
        <Field label="Deposit">{formatMinor(data.depositMinor)}</Field>
      </div>

      {data.tabInvoice ? (
        <div className="mt-4 rounded-lg border p-3 text-sm">
          <div className="mb-2 flex items-center justify-between">
            <span className="font-medium"><Tx>Settlement invoice </Tx>{data.tabInvoice.code}</span>
            <Badge variant="outline">{data.tabInvoice.status}</Badge>
          </div>
{data.tabInvoice.items?.length ? (
            <ul className="space-y-1 text-muted-foreground">
              {data.tabInvoice.items.map((i) => (
                <li key={i.id} className="flex justify-between">
                  <span>{i.name}</span>
                  <span>{formatMinor(i.amountMinor)}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-muted-foreground"><Tx>No lines yet.</Tx></p>
          )}
          <div className="mt-2 flex justify-between border-t pt-2 font-medium">
            <span><Tx>Total</Tx></span>
            <span>{formatMinor(data.tabInvoice.totalMinor)}</span>
          </div>
        </div>
      ) : null}

      {data.status === "checked_in" ? (
        <div className="mt-4 space-y-3 rounded-lg border p-3">
          <div className="grid gap-2 sm:grid-cols-2">
            <label className="text-xs font-medium text-muted-foreground">
              <Tx>Pay method
              </Tx><SearchableSelect
                value={payMethod}
                onChange={setPayMethod}
                options={[
                  { value: "cash", label: "Cash" },
                  { value: "qr", label: "QR" },
                  { value: "card", label: "Card" }
                ]}
                className="mt-1 w-full rounded-md border bg-card px-2 py-2 text-sm"
                placeholder="Select method"
              />
            </label>
            <label className="text-xs font-medium text-muted-foreground">
              <Tx>Deposit collected via
              </Tx><SearchableSelect
                value={depositMethod}
                onChange={setDepositMethod}
                options={[
                  { value: "cash", label: "Cash" },
                  { value: "qr", label: "QR" },
                  { value: "card", label: "Card" }
                ]}
                className="mt-1 w-full rounded-md border bg-card px-2 py-2 text-sm"
                placeholder="Select method"
              />
            </label>
          </div>
          <label className="block text-xs font-medium text-muted-foreground">
            <Tx>Extend check-out to (optional)
            </Tx><Input type="datetime-local" value={extendTo} onChange={(e) => setExtendTo(e.target.value)} className="mt-1" />
          </label>
          <Button disabled={busy} className="w-full" onClick={() => runAction(data.id, "checkout", { payMethod, depositMethod, ...(extendTo ? { extendTo } : {}) }).then(onClose)}>
            Check out — issue invoice & settle
          </Button>
        </div>
      ) : null}

      {active && data.status !== "checked_in" ? (
        <div className="mt-4 flex flex-wrap gap-2">
          {data.status === "requested" ? (
            <Button disabled={busy} onClick={() => runAction(data.id, "confirm").then(onClose)}>
              Confirm
            </Button>
          ) : null}
          {data.status === "confirmed" ? (
            <Button disabled={busy} onClick={() => runAction(data.id, "checkin").then(onClose)}>
              Check in
            </Button>
          ) : null}
          {data.status === "requested" || data.status === "confirmed" ? (
            <Button variant="outline" disabled={busy} onClick={() => runAction(data.id, "cancel").then(onClose)}>
              Cancel
            </Button>
          ) : null}
          {new Date(data.checkIn).getTime() < Date.now() ? (
            <Button variant="outline" disabled={busy} onClick={() => runAction(data.id, "no_show").then(onClose)}>
              No-show
            </Button>
          ) : null}
        </div>
      ) : null}

      <div className="mt-4 rounded-lg border border-destructive/40 p-3">
        <label className="text-xs font-medium text-destructive">
          <Tx>Void booking
          </Tx><div className="mt-1 flex gap-2">
            <Input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Reason (required)" />
            <Button variant="destructive" disabled={busy || !reason.trim()} onClick={() => runAction(data.id, "void", { reason: reason.trim() }).then(onClose)}>
              Void
            </Button>
          </div>
        </label>
      </div>
    </Dialog>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <p className="text-sm">{children}</p>
    </div>
  );
}

// ─────────────────────────────────── New booking ───────────────────────────────────

function NewBookingDialog({
  modules,
  rooms,
  onClose,
  onDone
}: {
  modules: ModuleRow[];
  rooms: RoomRow[];
  onClose: () => void;
  onDone: () => void;
}) {
  const { push } = useToast();
  const now = new Date();
  const [moduleId, setModuleId] = useState(modules[0]?.id ?? "");
  const [roomId, setRoomId] = useState("");
  const [checkIn, setCheckIn] = useState(now.toISOString().slice(0, 16));
  const [checkOut, setCheckOut] = useState(new Date(now.getTime() + 2 * 3600_000).toISOString().slice(0, 16));
  const [guests, setGuests] = useState(1);
  const [guestName, setGuestName] = useState("");
  const [guestPhone, setGuestPhone] = useState("");
  const [guestIdNumber, setGuestIdNumber] = useState("");
  const [deposit, setDeposit] = useState("");
  const [posMode, setPosMode] = useState<"direct" | "tab">("direct");
  const [notes, setNotes] = useState("");
  const [quote, setQuote] = useState<StayQuote | null>(null);
  const [quoteErr, setQuoteErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const roomList = useMemo(() => rooms.filter((r) => r.status !== "maintenance"), [rooms]);

  async function refreshQuote() {
    if (!moduleId || !roomId || !checkIn || !checkOut) return;
    const r = await send("/api/stay/quote", "POST", { moduleId, roomId, checkIn, checkOut, guests });
    if (r.ok) {
      setQuote(r.data as StayQuote);
      setQuoteErr(null);
    } else {
      setQuote(null);
      setQuoteErr(r.message ?? "No quote");
    }
  }

  async function save() {
    setBusy(true);
    const r = await send("/api/stay/bookings", "POST", {
      moduleId,
      roomId,
      checkIn,
      checkOut,
      guests,
      guestName,
      guestPhone: guestPhone || undefined,
      guestIdNumber: guestIdNumber || undefined,
      depositMinor: Math.round((parseFloat(deposit) || 0) * 100),
      posMode,
      notes: notes || undefined
    });
    setBusy(false);
    push(r.ok ? { title: "Booking requested", variant: "success" } : { title: "Failed", description: r.message, variant: "destructive" });
    if (r.ok) onDone();
  }

  return (
    <Dialog open onClose={onClose} title="New short stay" description="Pick a module, a room and an interval — the price is quoted live." wide>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="text-xs font-medium text-muted-foreground">
          <Tx>Module
          </Tx><SearchableSelect
            value={moduleId}
            onChange={(v) => { setModuleId(v); setQuote(null); }}
            options={modules.filter((m) => m.isActive).map((m) => ({
              value: m.id,
              label: `${m.name} (${m.minDurationMinutes >= 1440 ? `${m.maxDurationMinutes / 1440}d` : `${m.maxDurationMinutes / 60}h`} max)`
            }))}
            className="mt-1 w-full rounded-md border bg-card px-2 py-2 text-sm"
            placeholder="Select module"
          />
        </label>
        <label className="text-xs font-medium text-muted-foreground">
          <Tx>Room
          </Tx><SearchableSelect
            value={roomId}
            onChange={(v) => { setRoomId(v); setQuote(null); }}
            options={[
              { value: "", label: "— select a room —" },
              ...roomList.map((r) => ({ value: r.id, label: `${r.number} (${r.type} · cap ${r.capacity})` }))
            ]}
            className="mt-1 w-full rounded-md border bg-card px-2 py-2 text-sm"
            placeholder="Select room"
          />
        </label>
        <label className="text-xs font-medium text-muted-foreground">
          <Tx>Check-in
          </Tx><Input type="datetime-local" value={checkIn} onChange={(e) => { setCheckIn(e.target.value); setQuote(null); }} className="mt-1" />
        </label>
        <label className="text-xs font-medium text-muted-foreground">
          <Tx>Check-out
          </Tx><Input type="datetime-local" value={checkOut} onChange={(e) => { setCheckOut(e.target.value); setQuote(null); }} className="mt-1" />
        </label>
        <label className="text-xs font-medium text-muted-foreground">
          <Tx>Guests
          </Tx><Input type="number" min={1} max={10} value={guests} onChange={(e) => { setGuests(parseInt(e.target.value) || 1); setQuote(null); }} className="mt-1" />
        </label>
        <label className="text-xs font-medium text-muted-foreground">
          <Tx>POS mode
          </Tx><SearchableSelect
            value={posMode}
            onChange={(v) => setPosMode(v as "direct" | "tab")}
            options={[
              { value: "direct", label: "Direct — settle at checkout" },
              { value: "tab", label: "Tab — share one invoice with POS room-charge" }
            ]}
            className="mt-1 w-full rounded-md border bg-card px-2 py-2 text-sm"
            placeholder="Select POS mode"
          />
        </label>
        <label className="text-xs font-medium text-muted-foreground">
          <Tx>Guest name *
          </Tx><Input value={guestName} onChange={(e) => setGuestName(e.target.value)} placeholder="Walk-in: name" className="mt-1" />
        </label>
        <label className="text-xs font-medium text-muted-foreground">
          <Tx>Guest phone
          </Tx><Input value={guestPhone} onChange={(e) => setGuestPhone(e.target.value)} placeholder="For repeat guests" className="mt-1" />
        </label>
        <label className="text-xs font-medium text-muted-foreground">
          <Tx>ID / passport
          </Tx><Input value={guestIdNumber} onChange={(e) => setGuestIdNumber(e.target.value)} className="mt-1" />
        </label>
        <label className="text-xs font-medium text-muted-foreground">
          <Tx>Deposit to collect (major)
          </Tx><Input type="number" min={0} step="0.01" value={deposit} onChange={(e) => setDeposit(e.target.value)} className="mt-1" />
        </label>
        <label className="text-xs font-medium text-muted-foreground sm:col-span-2">
          <Tx>Notes
          </Tx><Input value={notes} onChange={(e) => setNotes(e.target.value)} className="mt-1" />
        </label>
      </div>

      <div className="mt-4 flex items-center justify-between rounded-lg border p-3">
        <button type="button" onClick={refreshQuote} className="text-sm font-medium text-primary underline-offset-2 hover:underline">
          {quote ? "Re-quote" : "Quote price"}
        </button>
        {quoteErr ? <span className="text-sm text-destructive">{quoteErr}</span> : null}
        {quote ? (
          <div className="text-right">
            <p className="text-sm text-muted-foreground">
              {duration(quote.minutes)} · {quote.buckets.length} <Tx>bucket(s)
            </Tx></p>
            <p className="text-lg font-semibold tabular-nums">{formatMinor(quote.totalMinor)}</p>
          </div>
        ) : null}
      </div>

      <div className="mt-4 flex justify-end gap-2">
        <Button variant="outline" onClick={onClose}>
          Cancel
        </Button>
        <Button disabled={busy || !guestName.trim() || !roomId} onClick={save}>
          {busy ? "Creating…" : "Request booking"}
        </Button>
      </div>
    </Dialog>
  );
}

// ─────────────────────────────────── Modules ───────────────────────────────────

function ModulesTable({
  modules,
  rates,
  canWrite,
  onEdit,
  onCreate
}: {
  modules: ModuleRow[];
  rates: RateRow[];
  canWrite: boolean;
  onEdit: (m: ModuleRow) => void;
  onCreate: () => void;
}) {
  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        {canWrite ? (
          <Button onClick={onCreate}>Add module</Button>
        ) : null}
      </div>
      {modules.length === 0 ? (
        <EmptyState title="No rent modules" hint="Create an Hourly / Overnight / Day-use module, then add its rate ladder." />
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Module</TableHead>
              <TableHead>Strategy</TableHead>
              <TableHead>Envelope</TableHead>
              <TableHead>Guests</TableHead>
              <TableHead>Deposit</TableHead>
              <TableHead>Rates</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {modules.map((m) => (
              <TableRow key={m.id}>
                <TableCell>
                  <span className="font-medium">{m.name}</span>
                  <div className="text-xs text-muted-foreground">{m.slug}</div>
                </TableCell>
                <TableCell className="capitalize">{m.billingStrategy}</TableCell>
                <TableCell>
                  {duration(m.minDurationMinutes)} – {duration(m.maxDurationMinutes)}
                </TableCell>
                <TableCell>{m.minGuests}–{m.maxGuests}</TableCell>
                <TableCell>{formatMinor(m.defaultDepositMinor)}</TableCell>
                <TableCell>{rates.filter((r) => r.moduleId === m.id && r.isActive).length}</TableCell>
                <TableCell>
                  <Badge variant={m.isActive ? "success" : "outline"}>{m.isActive ? "Active" : "Archived"}</Badge>
                </TableCell>
                <TableCell className="text-right">
                  {canWrite ? (
                    <Button variant="outline" size="sm" onClick={() => onEdit(m)}>
                      Edit
                    </Button>
                  ) : null}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}

function ModuleDialog({ existing, onClose }: { existing?: ModuleRow; onClose: () => void }) {
  const { push } = useToast();
  const [name, setName] = useState(existing?.name ?? "");
  const [slug, setSlug] = useState(existing?.slug ?? "");
  const [minDurationMinutes, setMinDuration] = useState(existing?.minDurationMinutes ?? 120);
  const [maxDurationMinutes, setMaxDuration] = useState(existing?.maxDurationMinutes ?? 1440);
  const [billingStrategy, setStrategy] = useState(existing?.billingStrategy ?? "progressive");
  const [defaultDepositMinor, setDeposit] = useState(existing?.defaultDepositMinor ?? 0);
  const [minGuests, setMinGuests] = useState(existing?.minGuests ?? 1);
  const [maxGuests, setMaxGuests] = useState(existing?.maxGuests ?? 4);
  const [isActive, setIsActive] = useState(existing?.isActive ?? true);
  const [busy, setBusy] = useState(false);

  async function save() {
    setBusy(true);
    const body = {
      name,
      ...(existing ? {} : { slug }),
      billingStrategy,
      minDurationMinutes,
      maxDurationMinutes,
      defaultDepositMinor,
      minGuests,
      maxGuests,
      ...(existing ? { isActive } : {})
    };
    const r = await send(existing ? `/api/stay/modules/${existing.id}` : "/api/stay/modules", existing ? "PATCH" : "POST", body);
    setBusy(false);
    push(r.ok ? { title: existing ? "Module updated" : "Module created", variant: "success" } : { title: "Failed", description: r.message, variant: "destructive" });
    if (r.ok) onClose();
  }

  return (
    <Dialog open onClose={onClose} title={existing ? `Edit ${existing.name}` : "New rent module"}>
      <div className="grid gap-3">
        <Field label="Name">
          <Input value={name} onChange={(e) => setName(e.target.value)} />
        </Field>
        {!existing ? (
          <Field label="Slug (url-safe, e.g. hourly)">
            <Input value={slug} onChange={(e) => setSlug(e.target.value)} />
          </Field>
        ) : null}
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Min duration (minutes)">
            <Input type="number" value={minDurationMinutes} onChange={(e) => setMinDuration(parseInt(e.target.value) || 0)} />
          </Field>
          <Field label="Max duration (minutes)">
            <Input type="number" value={maxDurationMinutes} onChange={(e) => setMaxDuration(parseInt(e.target.value) || 0)} />
          </Field>
          <Field label="Price strategy">
            <SearchableSelect
              value={billingStrategy}
              onChange={setStrategy}
              options={[
                { value: "progressive", label: "Progressive" },
                { value: "blended", label: "Blended (+ full day carry)" }
              ]}
              className="mt-1 w-full rounded-md border bg-card px-2 py-2 text-sm"
              placeholder="Select strategy"
            />
          </Field>
          <Field label="Min guests">
            <Input type="number" value={minGuests} onChange={(e) => setMinGuests(parseInt(e.target.value) || 1)} />
          </Field>
          <Field label="Max guests">
            <Input type="number" value={maxGuests} onChange={(e) => setMaxGuests(parseInt(e.target.value) || 1)} />
          </Field>
        </div>
        <Field label="Default deposit (minor units)">
          <Input type="number" value={defaultDepositMinor} onChange={(e) => setDeposit(parseInt(e.target.value) || 0)} />
        </Field>
        {existing ? (
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} />
            <Tx>Active (archive to hide from booking)
          </Tx></label>
        ) : null}
      </div>
      <div className="mt-4 flex justify-end gap-2">
        <Button variant="outline" onClick={onClose}>
          Cancel
        </Button>
        <Button disabled={busy || name.trim().length < 2} onClick={save}>
          {existing ? "Save" : "Create"}
        </Button>
      </div>
    </Dialog>
  );
}

// ─────────────────────────────────── Rates ───────────────────────────────────

function RatesTable({
  modules,
  rates,
  properties,
  filter,
  setFilter,
  canWrite,
  onEdit,
  onCreate
}: {
  modules: ModuleRow[];
  rates: RateRow[];
  properties: PropertyRow[];
  filter: string;
  setFilter: (v: string) => void;
  canWrite: boolean;
  onEdit: (r: RateRow) => void;
  onCreate: (moduleId: string) => void;
}) {
  const filtered = filter === "all" ? rates : rates.filter((r) => r.moduleId === filter);
  const propCode = (id: string | null) => (id ? properties.find((p) => p.id === id)?.code ?? id.slice(-4) : "global");
  const moduleById = new Map(modules.map((m) => [m.id, m]));

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <SearchableSelect
          value={filter}
          onChange={setFilter}
          options={[
            { value: "all", label: "All modules" },
            ...modules.map((m) => ({ value: m.id, label: m.name }))
          ]}
          className="rounded-md border bg-card px-2 py-2 text-sm"
          placeholder="All modules"
        />
        {canWrite ? <Button onClick={() => onCreate(filter === "all" ? modules[0]?.id ?? "" : filter)}>Add rate</Button> : null}
      </div>
      {filtered.length === 0 ? (
        <EmptyState title="No rate rules" hint="A ladder of progressive buckets sets the price: first bucket whose upper bound covers the duration wins." />
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Module</TableHead>
              <TableHead className="text-right">Bucket ≤</TableHead>
              <TableHead className="text-right">Price</TableHead>
              <TableHead>Scope</TableHead>
              <TableHead>Effective</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map((r) => {
              const m = moduleById.get(r.moduleId);
              const ladder = rates.filter((x) => x.moduleId === r.moduleId && x.isActive).map((x) => ({ toMinutes: x.toMinutes, priceMinor: x.priceMinor })).sort((a, b) => a.toMinutes - b.toMinutes);
              const priceAt = (mins: number) => ladder.find((b) => mins <= b.toMinutes)?.priceMinor ?? null;
              return (
                <TableRow key={r.id}>
                  <TableCell>{r.module?.name ?? m?.name ?? r.moduleId.slice(-6)}</TableCell>
                  <TableCell className="text-right tabular-nums">{duration(r.toMinutes)}</TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatMinor(r.priceMinor)}
                    <div className="text-xs text-muted-foreground">
                      {ladder.length > 0 && (priceAt(r.toMinutes) ?? 0) === r.priceMinor ? "drives price" : "overridden"}
                    </div>
                  </TableCell>
                  <TableCell>
                    {r.roomType ?? "all types"}
                    <div className="text-xs text-muted-foreground">{propCode(r.propertyId)}</div>
                  </TableCell>
                  <TableCell className="whitespace-nowrap text-xs">
                    {new Date(r.effectiveFrom).toLocaleDateString()}
                    {r.effectiveThrough ? ` → ${new Date(r.effectiveThrough).toLocaleDateString()}` : ""}
                  </TableCell>
                  <TableCell>
                    <Badge variant={r.isActive ? "success" : "outline"}>{r.isActive ? "Active" : "Off"}</Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    {canWrite ? (
                      <div className="flex justify-end gap-1">
                        <Button variant="outline" size="sm" onClick={() => onEdit(r)}>
                          Edit
                        </Button>
                      </div>
                    ) : null}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      )}
    </div>
  );
}

function RateDialog({
  modules,
  properties,
  existing,
  presetModuleId,
  onClose
}: {
  modules: ModuleRow[];
  properties: PropertyRow[];
  existing?: RateRow;
  presetModuleId?: string;
  onClose: () => void;
}) {
  const { push } = useToast();
  const [moduleId, setModuleId] = useState(existing?.moduleId ?? presetModuleId ?? modules[0]?.id ?? "");
  const [toMinutes, setToMinutes] = useState(existing ? existing.toMinutes : 240);
  const [price, setPrice] = useState(existing ? (existing.priceMinor / 100).toString() : "");
  const [propertyId, setPropertyId] = useState(existing?.propertyId ?? "");
  const [roomType, setRoomType] = useState(existing?.roomType ?? "");
  const [effectiveFrom, setEffectiveFrom] = useState(existing ? existing.effectiveFrom.slice(0, 10) : new Date().toISOString().slice(0, 10));
  const [busy, setBusy] = useState(false);

  async function save() {
    setBusy(true);
    const body = {
      ...(existing ? {} : { moduleId }),
      toMinutes,
      priceMinor: Math.round((parseFloat(price) || 0) * 100),
      propertyId: propertyId || null,
      roomType: roomType || null,
      effectiveFrom: new Date(`${effectiveFrom}T00:00:00`).toISOString()
    };
    const r = await send(existing ? `/api/stay/rates/${existing.id}` : "/api/stay/rates", existing ? "PATCH" : "POST", body);
    setBusy(false);
    push(r.ok ? { title: existing ? "Rate updated" : "Rate added", variant: "success" } : { title: "Failed", description: r.message, variant: "destructive" });
    if (r.ok) onClose();
  }

  return (
    <Dialog open onClose={onClose} title={existing ? "Edit rate rule" : "Add rate rule"}>
      <div className="grid gap-3">
        {!existing ? (
          <Field label="Module">
            <SearchableSelect
              value={moduleId}
              onChange={setModuleId}
              options={modules.map((m) => ({ value: m.id, label: m.name }))}
              className="w-full rounded-md border bg-card px-2 py-2 text-sm"
              placeholder="Select module"
            />
          </Field>
        ) : null}
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Bucket upper bound (minutes)">
            <Input type="number" value={toMinutes} onChange={(e) => setToMinutes(parseInt(e.target.value) || 0)} />
          </Field>
          <Field label="Price (major)">
            <Input type="number" min={0} step="0.01" value={price} onChange={(e) => setPrice(e.target.value)} />
          </Field>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Property scope">
            <SearchableSelect
              value={propertyId}
              onChange={setPropertyId}
              options={[
                { value: "", label: "Global (all properties)" },
                ...properties.map((p) => ({ value: p.id, label: p.code }))
              ]}
              className="w-full rounded-md border bg-card px-2 py-2 text-sm"
              placeholder="Select property"
            />
          </Field>
          <Field label="Room type">
            <SearchableSelect
              value={roomType}
              onChange={setRoomType}
              options={[
                { value: "", label: "All types" },
                { value: "STANDARD", label: "Standard" },
                { value: "DELUXE", label: "Deluxe" },
                { value: "STUDIO", label: "Studio" },
                { value: "SUITE", label: "Suite" }
              ]}
              className="w-full rounded-md border bg-card px-2 py-2 text-sm"
              placeholder="Select type"
            />
          </Field>
        </div>
        <Field label="Effective from">
          <Input type="date" value={effectiveFrom} onChange={(e) => setEffectiveFrom(e.target.value)} />
        </Field>
        <p className="rounded-lg bg-muted/60 p-2 text-xs text-muted-foreground">
          <Tx>First bucket whose upper bound ≥ stay duration wins (progressive). For blended days add a 1440-minute bucket and longer spans bill whole days + remainder.</Tx>
        </p>
      </div>
      <div className="mt-4 flex justify-end gap-2">
        <Button variant="outline" onClick={onClose}>
          Cancel
        </Button>
        <Button disabled={busy || !price || toMinutes <= 0} onClick={save}>
          {existing ? "Save" : "Add"}
        </Button>
      </div>
    </Dialog>
  );
}