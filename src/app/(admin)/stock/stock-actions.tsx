"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Input, Label, Select, Textarea } from "@/components/ui/input";
import { useToast } from "@/components/toast";

interface Props {
  mode: "create";
  items: { id: string; label: string; propertyId: string; unit: string }[];
  suppliers: { id: string; label: string }[];
  properties: string[];
  tickets: { id: string; label: string }[];
  canWriteTickets: boolean;
}

export function StockActions({ items, suppliers, properties, tickets, canWriteTickets }: Props) {
  const router = useRouter();
  const { push } = useToast();
  const [busy, setBusy] = useState(false);

  async function post(url: string, body: unknown, okTitle: string, onDone?: () => void) {
    setBusy(true);
    const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const data = (await res.json().catch(() => ({}))) as { message?: string; code?: string };
    setBusy(false);
    if (!res.ok) {
      push({ title: "Failed", description: data.message ?? data.code, variant: "destructive" });
      return;
    }
    push({ title: okTitle, variant: "success" });
    onDone?.();
    router.refresh();
  }

  return (
    <div className="mb-4 flex flex-wrap gap-2">
      <PurchaseDialog busy={busy} items={items} onDone={(b) => post("/api/stock/purchase", b, "Purchase recorded")} />
      <ConsumeDialog busy={busy} items={items} onDone={(b) => post("/api/stock/consume", b, "Consumption recorded")} />
      <TransferDialog busy={busy} items={items} onDone={(b) => post("/api/stock/transfer", b, "Transfer recorded")} />
      <NewitemDialog busy={busy} suppliers={suppliers} properties={properties} onDone={(b) => post("/api/stock/items", b, "Item created")} />
      <StocktakeDialog busy={busy} items={items} onDone={(b) => post("/api/stock/stocktakes", b, "Stocktake completed")} />
      {canWriteTickets && tickets.length > 0 && items.length > 0 ? <PartDialog busy={busy} items={items} tickets={tickets} onDone={(ticketId, b) => post(`/api/maintenance/tickets/${ticketId}/consume-part`, b, "Part consumed onto ticket")} /> : null}
    </div>
  );
}

function PurchaseDialog({ busy, items, onDone }: { busy: boolean; items: { id: string; label: string; unit: string }[]; onDone: (b: Record<string, unknown>) => Promise<void> }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button size="sm" onClick={() => setOpen(true)}>
        Purchase…
      </Button>
      <Dialog open={open} onClose={() => setOpen(false)} title="Purchase stock" description="Adds on-hand at unit cost; the moving average absorbs the new price.">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const fd = new FormData(e.currentTarget);
            void onDone({ stockItemId: String(fd.get("stockItemId")), qty: Number(fd.get("qty")), unitCost: Number(fd.get("unitCost")), note: String(fd.get("note") ?? "") || undefined }).then(() => setOpen(false));
          }}
          className="space-y-4"
        >
          <div className="space-y-1.5">
            <Label htmlFor="po-item">Item</Label>
            <Select id="po-item" name="stockItemId" defaultValue={items[0]?.id} required>
              {items.map((i) => (
                <option key={i.id} value={i.id}>
                  {i.label}
                </option>
              ))}
            </Select>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="po-qty">Quantity</Label>
              <Input id="po-qty" name="qty" type="number" step="0.001" min="0.001" required />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="po-cost">Unit cost</Label>
              <Input id="po-cost" name="unitCost" type="number" step="0.01" min="0.01" required />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="po-note">Note (invoice / delivery ref)</Label>
            <Input id="po-note" name="note" maxLength={300} />
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={busy}>
              Record purchase
            </Button>
          </div>
        </form>
      </Dialog>
    </>
  );
}

function ConsumeDialog({ busy, items, onDone }: { busy: boolean; items: { id: string; label: string; unit: string }[]; onDone: (b: Record<string, unknown>) => Promise<void> }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button size="sm" variant="outline" onClick={() => setOpen(true)}>
        Consume…
      </Button>
      <Dialog open={open} onClose={() => setOpen(false)} title="Consume stock" description="Manual consumption with a required reason (damage, sample, internal use…).">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const fd = new FormData(e.currentTarget);
            void onDone({ stockItemId: String(fd.get("stockItemId")), qty: Number(fd.get("qty")), note: String(fd.get("note")) }).then(() => setOpen(false));
          }}
          className="space-y-4"
        >
          <div className="space-y-1.5">
            <Label htmlFor="cn-item">Item</Label>
            <Select id="cn-item" name="stockItemId" defaultValue={items[0]?.id} required>
              {items.map((i) => (
                <option key={i.id} value={i.id}>
                  {i.label}
                </option>
              ))}
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="cn-qty">Quantity</Label>
            <Input id="cn-qty" name="qty" type="number" step="0.001" min="0.001" required />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="cn-note">Reason</Label>
            <Textarea id="cn-note" name="note" rows={2} maxLength={300} required minLength={3} />
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="secondary" disabled={busy}>
              Consume
            </Button>
          </div>
        </form>
      </Dialog>
    </>
  );
}

function TransferDialog({ busy, items, onDone }: { busy: boolean; items: { id: string; label: string; unit: string }[]; onDone: (b: Record<string, unknown>) => Promise<void> }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button size="sm" variant="outline" onClick={() => setOpen(true)}>
        Transfer…
      </Button>
      <Dialog open={open} onClose={() => setOpen(false)} title="Transfer stock" description="Move on-hand from one item to another (e.g. storeroom → kiosk) within the same property.">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const fd = new FormData(e.currentTarget);
            void onDone({ fromItemId: String(fd.get("fromItemId")), toItemId: String(fd.get("toItemId")), qty: Number(fd.get("qty")), note: String(fd.get("note") ?? "") || undefined }).then(() => setOpen(false));
          }}
          className="space-y-4"
        >
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="tr-from">From</Label>
              <Select id="tr-from" name="fromItemId" defaultValue={items[0]?.id} required>
                {items.map((i) => (
                  <option key={i.id} value={i.id}>
                    {i.label}
                  </option>
                ))}
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="tr-to">To</Label>
              <Select id="tr-to" name="toItemId" defaultValue={items[1]?.id ?? items[0]?.id} required>
                {items.map((i) => (
                  <option key={i.id} value={i.id}>
                    {i.label}
                  </option>
                ))}
              </Select>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="tr-qty">Quantity</Label>
            <Input id="tr-qty" name="qty" type="number" step="0.001" min="0.001" required />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="tr-note">Note</Label>
            <Input id="tr-note" name="note" maxLength={300} />
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="secondary" disabled={busy}>
              Transfer
            </Button>
          </div>
        </form>
      </Dialog>
    </>
  );
}

function NewitemDialog({ busy, suppliers, properties, onDone }: { busy: boolean; suppliers: { id: string; label: string }[]; properties: string[]; onDone: (b: Record<string, unknown>) => Promise<void> }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button size="sm" variant="outline" onClick={() => setOpen(true)}>
        New item…
      </Button>
      <Dialog open={open} onClose={() => setOpen(false)} title="New stock item" description="Starts at zero on-hand — purchase to add stock.">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const fd = new FormData(e.currentTarget);
            void onDone({
              name: String(fd.get("name")),
              category: String(fd.get("category")),
              unit: String(fd.get("unit")),
              minQty: Number(fd.get("minQty") ?? 0) || 0,
              supplierId: String(fd.get("supplierId") ?? "") || undefined,
              propertyId: String(fd.get("propertyId"))
            }).then(() => setOpen(false));
          }}
          className="space-y-4"
        >
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="ni-name">Name</Label>
              <Input id="ni-name" name="name" minLength={2} maxLength={120} required />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ni-cat">Category</Label>
              <Select id="ni-cat" name="category" defaultValue="beverage" required>
                {["beverage", "snack", "grocery", "supply", "part", "other"].map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ni-unit">Unit</Label>
              <Input id="ni-unit" name="unit" maxLength={20} placeholder="pcs / kg / l / box" required />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ni-min">Low-stock threshold</Label>
              <Input id="ni-min" name="minQty" type="number" step="0.001" min="0" defaultValue={0} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ni-sup">Supplier</Label>
              <Select id="ni-sup" name="supplierId" defaultValue="">
                <option value="">—</option>
                {suppliers.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.label}
                  </option>
                ))}
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ni-prop">Property</Label>
              <Select id="ni-prop" name="propertyId" defaultValue={properties[0]} required>
                {properties.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </Select>
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={busy}>
              Create item
            </Button>
          </div>
        </form>
      </Dialog>
    </>
  );
}

function StocktakeDialog({ busy, items, onDone }: { busy: boolean; items: { id: string; label: string; propertyId: string; unit: string }[]; onDone: (b: Record<string, unknown>) => Promise<void> }) {
  const [open, setOpen] = useState(false);
  const [counts, setCounts] = useState<Record<string, string>>({});
  const byProperty = items[0]?.propertyId ?? "";
  return (
    <>
      <Button size="sm" variant="outline" onClick={() => setOpen(true)}>
        Stocktake…
      </Button>
      <Dialog open={open} onClose={() => setOpen(false)} title="Stocktake" description={`Count each item (currently ${items.length} lines, property ${byProperty}). Variances post adjustment movements.`} wide>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void onDone({
              propertyId: byProperty,
              counted: items.map((i) => ({ stockItemId: i.id, counted: Number(counts[i.id] ?? "0") || 0 }))
            }).then(() => setOpen(false));
          }}
          className="space-y-4"
        >
          <div className="max-h-72 space-y-2 overflow-y-auto">
            {items.map((i) => (
              <div key={i.id} className="grid grid-cols-12 items-center gap-2">
                <span className="col-span-8 truncate text-sm">{i.label}</span>
                <Input
                  className="col-span-4"
                  type="number"
                  step="0.001"
                  min="0"
                  placeholder={`counted (${i.unit})`}
                  value={counts[i.id] ?? ""}
                  onChange={(e) => setCounts((c) => ({ ...c, [i.id]: e.target.value }))}
                  required
                />
              </div>
            ))}
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={busy || Object.keys(counts).length < items.length}>
              Post stocktake
            </Button>
          </div>
        </form>
      </Dialog>
    </>
  );
}

function PartDialog({
  busy,
  items,
  tickets,
  onDone
}: {
  busy: boolean;
  items: { id: string; label: string; unit: string }[];
  tickets: { id: string; label: string }[];
  onDone: (ticketId: string, b: Record<string, unknown>) => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button size="sm" variant="outline" onClick={() => setOpen(true)}>
        Part → ticket…
      </Button>
      <Dialog open={open} onClose={() => setOpen(false)} title="Consume part into a ticket" description="Maintenance_use movement + a material cost line at moving average on the ticket.">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const fd = new FormData(e.currentTarget);
            void onDone(String(fd.get("ticketId")), {
              stockItemId: String(fd.get("stockItemId")),
              qty: Number(fd.get("qty")),
              label: String(fd.get("label") ?? "") || undefined
            }).then(() => setOpen(false));
          }}
          className="space-y-4"
        >
          <div className="space-y-1.5">
            <Label htmlFor="pt-ticket">Ticket</Label>
            <Select id="pt-ticket" name="ticketId" defaultValue={tickets[0]?.id} required>
              {tickets.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.label}
                </option>
              ))}
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="pt-item">Part</Label>
            <Select id="pt-item" name="stockItemId" defaultValue={items[0]?.id} required>
              {items.map((i) => (
                <option key={i.id} value={i.id}>
                  {i.label}
                </option>
              ))}
            </Select>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="pt-qty">Quantity</Label>
              <Input id="pt-qty" name="qty" type="number" step="0.001" min="0.001" required />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="pt-label">Label (optional)</Label>
              <Input id="pt-label" name="label" maxLength={120} />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={busy}>
              Consume part
            </Button>
          </div>
        </form>
      </Dialog>
    </>
  );
}
