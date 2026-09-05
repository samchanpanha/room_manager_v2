"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Input, Label, Textarea } from "@/components/ui/input";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { useToast } from "@/components/toast";

interface Props {
  mode: "create";
  items: { id: string; label: string; propertyId: string; unit: string; packUnit: string | null; packSize: number | null }[];
  suppliers: { id: string; label: string }[];
  properties: string[];
  tickets: { id: string; label: string }[];
  canWriteTickets: boolean;
  categories: { value: string; label: string }[];
  units: string[];
}

export function StockActions({ items, suppliers, properties, tickets, canWriteTickets, categories, units }: Props) {
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
      <NewitemDialog busy={busy} suppliers={suppliers} properties={properties} categories={categories} units={units} onDone={(b) => post("/api/stock/items", b, "Item created")} />
      <StocktakeDialog busy={busy} items={items} onDone={(b) => post("/api/stock/stocktakes", b, "Stocktake completed")} />
      {canWriteTickets && tickets.length > 0 && items.length > 0 ? <PartDialog busy={busy} items={items} tickets={tickets} onDone={(ticketId, b) => post(`/api/maintenance/tickets/${ticketId}/consume-part`, b, "Part consumed onto ticket")} /> : null}
    </div>
  );
}

function PurchaseDialog({ busy, items, onDone }: { busy: boolean; items: { id: string; label: string; unit: string; packUnit: string | null; packSize: number | null }[]; onDone: (b: Record<string, unknown>) => Promise<void> }) {
  const [open, setOpen] = useState(false);
  const [itemId, setItemId] = useState(items[0]?.id ?? "");
  const [buyUnit, setBuyUnit] = useState<"unit" | "pack">("unit");
  const item = items.find((i) => i.id === itemId) ?? null;
  const pack = item && item.packUnit && item.packSize ? { unit: item.packUnit, size: item.packSize } : null;
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
            void onDone({
              stockItemId: itemId,
              qty: Number(fd.get("qty")),
              unitCost: Number(fd.get("unitCost")),
              ...(buyUnit === "pack" ? { unit: "pack" } : {}),
              note: String(fd.get("note") ?? "") || undefined
            }).then(() => setOpen(false));
          }}
          className="space-y-4"
        >
          <div className="space-y-1.5">
            <Label htmlFor="po-item">Item</Label>
            <SearchableSelect
              id="po-item"
              value={itemId}
              onChange={(v) => {
                setItemId(v);
                setBuyUnit("unit");
              }}
              required
              options={items.map((i) => ({ value: i.id, label: i.label }))}
            />
          </div>
          {pack ? (
            <div className="space-y-1.5">
              <Label htmlFor="po-buyunit">Purchase unit</Label>
              <SearchableSelect
                id="po-buyunit"
                value={buyUnit}
                onChange={(v) => setBuyUnit(v as "unit" | "pack")}
                options={[{ value: "unit", label: `per ${item!.unit}` }, { value: "pack", label: `per ${pack.unit}` }]}
              />
              <p className="text-xs text-muted-foreground">
                1 {pack.unit} = {pack.size} {item!.unit}
              </p>
            </div>
          ) : null}
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="po-qty">Quantity {buyUnit === "pack" && pack ? `(${pack.unit})` : item ? `(${item.unit})` : ""}</Label>
              <Input id="po-qty" name="qty" type="number" step="0.001" min="0.001" required />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="po-cost">Unit cost {buyUnit === "pack" && pack ? `per ${pack.unit}` : "per unit"}</Label>
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
            <SearchableSelect id="cn-item" name="stockItemId" defaultValue={items[0]?.id} required options={items.map((i) => ({ value: i.id, label: i.label }))} />
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
              <SearchableSelect id="tr-from" name="fromItemId" defaultValue={items[0]?.id} required options={items.map((i) => ({ value: i.id, label: i.label }))} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="tr-to">To</Label>
              <SearchableSelect id="tr-to" name="toItemId" defaultValue={items[1]?.id ?? items[0]?.id} required options={items.map((i) => ({ value: i.id, label: i.label }))} />
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

function NewitemDialog({ busy, suppliers, properties, categories, units, onDone }: { busy: boolean; suppliers: { id: string; label: string }[]; properties: string[]; categories: { value: string; label: string }[]; units: string[]; onDone: (b: Record<string, unknown>) => Promise<void> }) {
  const [open, setOpen] = useState(false);
  const [unitInput, setUnitInput] = useState("");
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
              categoryId: String(fd.get("categoryId") ?? "") || undefined,
              unit: String(fd.get("unit")),
              packUnit: String(fd.get("packUnit") ?? "") || null,
              packSize: Number(fd.get("packSize") ?? "") || null,
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
              <SearchableSelect
                id="ni-cat"
                name="categoryId"
                defaultValue=""
                options={[{ value: "", label: "— uncategorized" }, ...categories.map((c) => ({ value: c.value, label: c.label }))]}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ni-unit">Unit</Label>
              <Input id="ni-unit" name="unit" maxLength={20} list="unit-options" placeholder="pcs / kg / l / box" value={unitInput} onChange={(e) => setUnitInput(e.target.value)} required />
              <datalist id="unit-options">
                {units.map((u) => (
                  <option key={u} value={u} />
                ))}
              </datalist>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ni-min">Low-stock threshold</Label>
              <Input id="ni-min" name="minQty" type="number" step="0.001" min="0" defaultValue={0} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ni-packunit">Pack unit (optional)</Label>
              <Input id="ni-packunit" name="packUnit" maxLength={20} list="pack-unit-options" placeholder="e.g. carton" />
              <datalist id="pack-unit-options">
                {units.map((u) => (
                  <option key={u} value={u} />
                ))}
              </datalist>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ni-packsize">1 pack = how many {unitInput.trim() || "units"}?</Label>
              <Input id="ni-packsize" name="packSize" type="number" step="1" min="2" placeholder="e.g. 12" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ni-sup">Supplier</Label>
              <SearchableSelect
                id="ni-sup"
                name="supplierId"
                defaultValue=""
                options={[{ value: "", label: "—" }, ...suppliers.map((s) => ({ value: s.id, label: s.label }))]}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ni-prop">Property</Label>
              <SearchableSelect id="ni-prop" name="propertyId" defaultValue={properties[0]} required options={properties.map((p) => ({ value: p, label: p }))} />
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
            <SearchableSelect id="pt-ticket" name="ticketId" defaultValue={tickets[0]?.id} required options={tickets.map((t) => ({ value: t.id, label: t.label }))} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="pt-item">Part</Label>
            <SearchableSelect id="pt-item" name="stockItemId" defaultValue={items[0]?.id} required options={items.map((i) => ({ value: i.id, label: i.label }))} />
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
