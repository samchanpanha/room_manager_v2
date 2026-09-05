"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog } from "@/components/ui/dialog";
import { Card, CardContent } from "@/components/ui/card";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { useToast } from "@/components/toast";
import { cn } from "@/lib/utils";
import { Tx } from "@/components/i18n-text";

interface StockItemRow {
  id: string;
  name: string;
  unit: string;
  qtyMilli: number;
}

interface PoLine {
  id: string;
  qtyMilli: number;
  unitCostMilli: number;
  receivedMilli: number;
  isSnapshot?: boolean;
  stockItem?: { id: string; name: string; unit: string } | null;
}

interface PurchaseOrder {
  id: string;
  code: string;
  supplierName: string;
  status: string;
  note: string | null;
  totalMinor: number;
  receivedMinor: number;
  propertyId?: string;
  lines: PoLine[];
}

interface PoProps {
  canWrite: boolean;
  defaultPropertyId: string | null;
  visibleProperties: Array<{ id: string; code: string; name: string }>;
}

const STATUS_LABEL: Record<string, string> = { draft: "Draft", placed: "Placed", received: "Received", void: "Void" };
const STATUS_COLOR: Record<string, string> = {
  draft: "bg-muted text-muted-foreground",
  placed: "bg-amber-100 text-amber-800",
  received: "bg-emerald-100 text-emerald-800",
  void: "bg-muted text-muted-foreground"
};

const money = (minor: number) => (minor / 100).toFixed(2);
const qty = (milli: number, unit: string) => `${(milli / 1000).toLocaleString()} ${unit}`;

export function PoManager({ canWrite, defaultPropertyId, visibleProperties }: PoProps) {
  const router = useRouter();
  const { push } = useToast();
  const [propertyId, setPropertyId] = useState<string | null>(defaultPropertyId);
  const [status, setStatus] = useState("all");
  const [orders, setOrders] = useState<PurchaseOrder[]>([]);
  const [stockItems, setStockItems] = useState<StockItemRow[]>([]);
  const [suppliers, setSuppliers] = useState<Array<{ id: string; name: string }>>([]);
  const [loadState, setLoadState] = useState<"loading" | "ready" | "error">("loading");
  const [busy, setBusy] = useState(false);
  const [newOpen, setNewOpen] = useState(false);
  const [receiveFor, setReceiveFor] = useState<PurchaseOrder | null>(null);

  const load = useCallback(async (pid: string | null, st: string) => {
    setLoadState("loading");
    try {
      const qs = new URLSearchParams();
      if (pid) qs.set("propertyId", pid);
      qs.set("status", st);
      const res = await fetch(`/api/po?${qs}`);
      if (!res.ok) throw new Error("load failed");
      const data = (await res.json()) as { orders: PurchaseOrder[]; stockItems: StockItemRow[]; suppliers: Array<{ id: string; name: string }> };
      setOrders(data.orders);
      setStockItems(data.stockItems);
      setSuppliers(data.suppliers);
      setLoadState("ready");
    } catch {
      setLoadState("error");
    }
  }, []);

  useEffect(() => {
    void load(propertyId, status);
  }, [propertyId, status, load]);

  async function act(method: string, url: string, body?: unknown): Promise<boolean> {
    setBusy(true);
    try {
      const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: body ? JSON.stringify(body) : undefined });
      const data = (await res.json().catch(() => ({}))) as { message?: string };
      if (res.ok) {
        push({ title: "Done", variant: "success" });
        router.refresh();
        await load(propertyId, status);
        return true;
      }
      push({ title: "Failed", description: data.message, variant: "destructive" });
      return false;
    } finally {
      setBusy(false);
    }
  }

  const remainingByLine = useMemo(() => {
    const map: Record<string, number> = {};
    for (const o of receiveFor ? [receiveFor] : []) {
      for (const l of o.lines) map[l.id] = l.qtyMilli - l.receivedMilli;
    }
    return map;
  }, [receiveFor]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          {visibleProperties.length > 1 && (
            <SearchableSelect
              value={propertyId ?? ""}
              onChange={(v) => setPropertyId(v || null)}
              options={visibleProperties.map((p) => ({ value: p.id, label: `${p.code} · ${p.name}` }))}
              className="h-9 rounded-md border bg-transparent px-2 text-sm"
              placeholder="Select property"
            />
          )}
          {(["all", "draft", "placed", "received", "void"] as const).map((s) => (
            <Button key={s} size="sm" variant={status === s ? "default" : "outline"} onClick={() => setStatus(s)}>
              {s === "all" ? "All" : STATUS_LABEL[s]}
            </Button>
          ))}
        </div>
        {canWrite && (
          <Button size="sm" disabled={busy} onClick={() => setNewOpen(true)}>
            New purchase order
          </Button>
        )}
      </div>

      <Card>
        <CardContent className="pt-4">
          {loadState === "loading" && <p className="text-sm text-muted-foreground"><Tx>Loading…</Tx></p>}
          {loadState === "error" && <p className="text-sm text-destructive"><Tx>Could not load purchase orders.</Tx></p>}
          {loadState === "ready" && orders.length === 0 && <p className="text-sm text-muted-foreground"><Tx>No purchase orders yet.</Tx></p>}
          {loadState === "ready" && orders.length > 0 && (
            <div className="space-y-2">
              {orders.map((o) => (
                <div key={o.id} className="rounded-lg border p-3">
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
                    <span className="font-mono text-sm font-semibold">{o.code}</span>
                    <span className="text-sm">{o.supplierName || "No supplier"}</span>
                    <Badge className={cn(STATUS_COLOR[o.status] ?? "")}>{STATUS_LABEL[o.status] ?? o.status}</Badge>
                    <span className="text-sm text-muted-foreground">
                      ordered {money(o.totalMinor)} · received {money(o.receivedMinor)}
                    </span>
                    {o.note ? <span className="text-xs text-muted-foreground">{o.note}</span> : null}
                    <div className="ml-auto flex gap-2">
                      {canWrite && o.status === "draft" && (
                        <Button size="sm" variant="outline" disabled={busy} onClick={() => void act("POST", `/api/po/${o.id}`)}>
                          Place
                        </Button>
                      )}
                      {canWrite && o.status === "placed" && (
                        <Button size="sm" variant="outline" disabled={busy} onClick={() => setReceiveFor(o)}>
                          Receive
                        </Button>
                      )}
                      {canWrite && (o.status === "draft" || o.status === "placed") && (
                        <Button size="sm" variant="ghost" className="text-destructive" disabled={busy} onClick={() => void act("DELETE", `/api/po/${o.id}`)}>
                          Void
                        </Button>
                      )}
                    </div>
                  </div>
                  <ul className="mt-2 space-y-1 border-t pt-2 text-xs text-muted-foreground">
                    {o.lines.map((l) => (
                      <li key={l.id}>
                        {(l.stockItem?.name ?? "item")} — {qty(l.qtyMilli, l.stockItem?.unit ?? "u")} @ {money(l.unitCostMilli / 1000)}
                        {l.receivedMilli > 0 ? <span className="text-emerald-600"> · received {qty(l.receivedMilli, l.stockItem?.unit ?? "u")}</span> : null}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <NewPoDialog
        open={newOpen}
        onClose={() => setNewOpen(false)}
        propertyId={propertyId}
        stockItems={stockItems}
        suppliers={suppliers}
        busy={busy}
        onCreated={async (msg) => {
          push({ title: msg, variant: "success" });
          setNewOpen(false);
          router.refresh();
          await load(propertyId, status);
        }}
      />

      <ReceiveDialog
        po={receiveFor}
        remaining={remainingByLine}
        onClose={() => setReceiveFor(null)}
        busy={busy}
        onDone={async () => {
          setReceiveFor(null);
          router.refresh();
          await load(propertyId, status);
        }}
      />
    </div>
  );
}

function NewPoDialog({ open, onClose, propertyId, stockItems, suppliers, busy, onCreated }: {
  open: boolean;
  onClose: () => void;
  propertyId: string | null;
  stockItems: StockItemRow[];
  suppliers: Array<{ id: string; name: string }>;
  busy: boolean;
  onCreated: (msg: string) => Promise<void>;
}) {
  const [supplierId, setSupplierId] = useState("");
  const [freeSupplier, setFreeSupplier] = useState("");
  const [note, setNote] = useState("");
  const [lines, setLines] = useState<Array<{ stockItemId: string; qtyMilli: number; unitCostMinor: number }>>([{ stockItemId: "", qtyMilli: 1000, unitCostMinor: 100 }]);
  const [error, setError] = useState<string | null>(null);

  function setLine(i: number, patch: Partial<(typeof lines)[number]>) {
    setLines((prev) => prev.map((l, idx) => (idx === i ? { ...l, ...patch } : l)));
  }

  async function submit() {
    setError(null);
    if (!propertyId) return setError("No property selected.");
    if (!lines.length || lines.some((l) => !l.stockItemId || l.qtyMilli <= 0)) return setError("Every line needs a stock item and a positive quantity.");
    const res = await fetch("/api/po", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        propertyId,
        supplierId: supplierId || undefined,
        supplierName: freeSupplier || undefined,
        note: note || undefined,
        lines
      })
    });
    const data = (await res.json().catch(() => ({}))) as { code?: string; message?: string };
    if (!res.ok) return setError(data.message ?? "Could not create the purchase order");
    await onCreated(`Purchase order ${(data as { code?: string }).code ?? ""} created`);
  }

  return (
    <Dialog open={open} onClose={onClose} title="New purchase order" description="Order stock from a supplier. Nothing hits inventory until you receive." wide>
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-2">
          <label className="space-y-1 text-sm">
            <span className="text-muted-foreground"><Tx>Supplier (saved)</Tx></span>
            <SearchableSelect
              value={supplierId}
              onChange={setSupplierId}
              options={[
                { value: "", label: "— none —" },
                ...suppliers.map((s) => ({ value: s.id, label: s.name }))
              ]}
              className="h-9 w-full rounded-md border bg-transparent px-2 text-sm"
              placeholder="Select supplier"
            />
          </label>
          <label className="space-y-1 text-sm">
            <span className="text-muted-foreground"><Tx>Or supplier name (free text)</Tx></span>
            <Input value={freeSupplier} disabled={!!supplierId} placeholder="e.g. Sunrise Wholesale" onChange={(e) => setFreeSupplier(e.target.value)} />
          </label>
        </div>

        <div className="space-y-2">
          {lines.map((l, i) => (
            <div key={i} className="flex items-center gap-2">
              <SearchableSelect
                value={l.stockItemId}
                onChange={(v) => setLine(i, { stockItemId: v })}
                options={[
                  { value: "", label: "— stock item —" },
                  ...stockItems.map((s) => ({
                    value: s.id,
                    label: `${s.name} · on hand ${qty(s.qtyMilli, s.unit)}`,
                    disabled: lines.some((ll, li) => li !== i && ll.stockItemId === s.id)
                  }))
                ]}
                className="h-9 flex-1 rounded-md border bg-transparent px-2 text-sm"
                placeholder="Select stock item"
              />
              <Input type="number" className="w-28" min={1} value={l.qtyMilli === 0 ? "" : l.qtyMilli} placeholder="qty (milli)" onChange={(e) => setLine(i, { qtyMilli: Math.max(0, Math.round(Number(e.target.value) || 0)) })} />
              <Input type="number" className="w-28" min={0} value={l.unitCostMinor} placeholder="unit cost" onChange={(e) => setLine(i, { unitCostMinor: Math.max(0, Math.round(Number(e.target.value) || 0)) })} />
              <Button size="sm" variant="ghost" disabled={lines.length <= 1} onClick={() => setLines((prev) => prev.filter((_, xi) => xi !== i))}>
                ✕
              </Button>
            </div>
          ))}
          <Button size="sm" variant="outline" disabled={stockItems.length === 0} onClick={() => setLines((prev) => [...prev, { stockItemId: "", qtyMilli: 1000, unitCostMinor: 100 }])}>
            + Add line
          </Button>
        </div>

        <label className="space-y-1 text-sm">
          <span className="text-muted-foreground"><Tx>Note</Tx></span>
          <Input value={note} placeholder="Delivery date, terms…" onChange={(e) => setNote(e.target.value)} />
        </label>

        {error ? <p className="text-sm text-destructive">{error}</p> : null}
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button disabled={busy} onClick={() => void submit()}>Create</Button>
        </div>
      </div>
    </Dialog>
  );
}

function ReceiveDialog({ po, remaining, busy, onClose, onDone }: {
  po: PurchaseOrder | null;
  remaining: Record<string, number>;
  busy: boolean;
  onClose: () => void;
  onDone: () => Promise<void>;
}) {
  const [qtyInput, setQtyInput] = useState<Record<string, number>>({});
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (po) setQtyInput(Object.fromEntries(Object.entries(remaining).map(([id, r]) => [id, Math.max(0, r)])));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [po]);

  async function submit() {
    setError(null);
    if (!po) return;
    const received = Object.entries(qtyInput)
      .filter(([, v]) => v > 0)
      .map(([lineId, qtyMilli]) => ({ lineId, qtyMilli }));
    if (received.length === 0) return setError("Enter at least one received quantity.");
    const res = await fetch(`/api/po/${po.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ received })
    });
    const data = (await res.json().catch(() => ({}))) as { message?: string };
    if (!res.ok) return setError(data.message ?? "Could not receive stock");
    await onDone();
  }

  return (
    <Dialog open={!!po} onClose={onClose} title={`Receive ${po?.code ?? ""}`} description="Each received line posts a purchase stock movement — on hand and moving average update now.">
      <div className="space-y-2">
        {po?.lines.map((l) => {
          const remain = remaining[l.id] ?? 0;
          return (
            <div key={l.id} className="flex items-center gap-2 text-sm">
              <span className="flex-1">{l.stockItem?.name}</span>
              <span className="text-muted-foreground">{qty(remain, l.stockItem?.unit ?? "u")} remaining</span>
              <Input
                type="number"
                className="w-28"
                min={0}
                max={remain}
                value={qtyInput[l.id] ?? ""}
                onChange={(e) => setQtyInput({ ...qtyInput, [l.id]: Math.max(0, Math.min(remain, Math.round(Number(e.target.value) || 0))) })}
              />
            </div>
          );
        })}
        {error ? <p className="text-sm text-destructive">{error}</p> : null}
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button disabled={busy} onClick={() => void submit()}>Receive</Button>
        </div>
      </div>
    </Dialog>
  );
}