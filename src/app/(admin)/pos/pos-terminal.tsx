"use client";

import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Input, Label, Select } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { formatMinor } from "@/lib/money";
import { useToast } from "@/components/toast";

export type PosProduct = {
  id: string;
  name: string;
  priceMinor: number;
  category: string | null;
  barcode: string | null;
  stock: { id: string; name: string; qtyMilli: number; unit: string } | null;
};

export type PosSaleRow = {
  id: string;
  code: string;
  method: string;
  totalMinor: number;
  createdAt: string;
  memberName?: string;
  invoiceId: string | null;
  items: { id: string; name: string; qtyMilli: number; lineMinor: number }[];
};

export type PosMember = { id: string; label: string };

interface Props {
  property: { id: string } | null;
  openSession: { id: string; openingFloatMinor: number; sales: number; cashSalesMinor: number } | null;
  sales: PosSaleRow[];
  products: PosProduct[];
  members: PosMember[];
  categories: string[];
  canWrite: boolean;
}

interface PrintHints {
  autoPrintReceipt?: boolean;
  receiptCopies?: number;
  receiptUrl?: string;
  printBarcodeByDefault?: boolean;
  labelUrl?: string;
}

const METHOD_LABELS: Record<string, string> = { cash: "Cash", qr: "QR Pay", card: "Card", room_charge: "Charge to room" };

function digitsOnly(s: string): string {
  return s.replace(/\D/g, "");
}

export function PosTerminal({ property, openSession, sales, products, members, categories, canWrite }: Props) {
  const router = useRouter();
  const { push } = useToast();
  const [busy, setBusy] = useState(false);
  const [cart, setCart] = useState<Record<string, number>>({});
  const [method, setMethod] = useState("cash");
  const [memberId, setMemberId] = useState("");
  const [ref, setRef] = useState("");
  const [filterCat, setFilterCat] = useState("");
  const [query, setQuery] = useState("");
  const [scan, setScan] = useState("");
  const [printUrl, setPrintUrl] = useState<string | null>(null);
  const [sessionBusy, setSessionBusy] = useState(false);
  const [float, setFloat] = useState("0");
  const [counted, setCounted] = useState("");
  const [closeNote, setCloseNote] = useState("");
  const [openDialog, setOpenDialog] = useState(false);
  const [closeDialog, setCloseDialog] = useState(false);
  const scanRef = useRef<HTMLInputElement>(null);

  const byId = useMemo(() => new Map(products.map((p) => [p.id, p])), [products]);
  const visible = useMemo(
    () =>
      products.filter(
        (p) =>
          (!filterCat || (p.category ?? "") === filterCat) &&
          (!query ||
            p.name.toLowerCase().includes(query.toLowerCase()) ||
            (p.barcode ? digitsOnly(p.barcode).includes(digitsOnly(query)) && digitsOnly(query).length >= 4 : false))
      ),
    [products, filterCat, query]
  );

  const cartLines = Object.entries(cart)
    .map(([id, qty]) => ({ product: byId.get(id), qty }))
    .filter((l): l is { product: PosProduct; qty: number } => Boolean(l.product) && l.qty > 0);

  const totalMinor = cartLines.reduce((sum, l) => sum + l.product.priceMinor * l.qty, 0);
  const cashExpected = openSession ? openSession.openingFloatMinor + openSession.cashSalesMinor : 0;
  const outOfStockOnHand = (p: PosProduct): number => {
    if (!p.stock) return Number.POSITIVE_INFINITY;
    const parts = p.stock.qtyMilli / 1000;
    const step = p.stock.unit === "pcs" ? 1 : 0.5;
    return Math.floor(parts / step) * step;
  };

  function addToCart(id: string) {
    const p = byId.get(id);
    if (!p) return;
    const step = p.stock && p.stock.unit !== "pcs" ? 0.5 : 1;
    setCart((c) => ({ ...c, [id]: Math.min((c[id] ?? 0) + step, outOfStockOnHand(p)) }));
  }
  function setQty(id: string, qty: number) {
    const p = byId.get(id);
    if (!p) return;
    if (qty <= 0) {
      setCart((c) => {
        const next = { ...c };
        delete next[id];
        return next;
      });
      return;
    }
    setCart((c) => ({ ...c, [id]: Math.min(qty, p.stock ? p.stock.qtyMilli / 1000 : qty) }));
  }

  function handleScan(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key !== "Enter") return;
    const code = digitsOnly(scan);
    if (code.length < 10 || !openSession) return;
    const found = products.find((p) => p.barcode && digitsOnly(p.barcode) === code);
    setScan("");
    if (!found) {
      push({ title: "Unknown barcode", description: code, variant: "destructive" });
      return;
    }
    addToCart(found.id);
    push({ title: "Added", description: found.name, variant: "success" });
    scanRef.current?.focus();
  }

  async function post(url: string, body: unknown, okTitle: string, onSuccess?: (data: unknown) => void) {
    setBusy(true);
    const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const data = (await res.json().catch(() => ({}))) as { message?: string; code?: string; print?: PrintHints };
    setBusy(false);
    if (!res.ok) {
      push({ title: "Failed", description: data.message ?? data.code, variant: "destructive" });
      return;
    }
    push({ title: okTitle, variant: "success" });
    onSuccess?.(data);
    router.refresh();
  }

  function printHints(data: unknown) {
    const p = (data as { print?: PrintHints })?.print;
    if (!p) return;
    if (p.autoPrintReceipt && p.receiptUrl) setPrintUrl(`${p.receiptUrl}?copies=${p.receiptCopies ?? 1}`);
    if (p.printBarcodeByDefault && p.labelUrl) window.open(p.labelUrl, "_blank", "noopener");
  }

  async function doOpenSession() {
    if (!property) return;
    setSessionBusy(true);
    await post("/api/pos/sessions", { propertyId: property.id, float: Number(float) || 0 }, "Session opened");
    setSessionBusy(false);
    setOpenDialog(false);
  }
  async function doCloseSession() {
    if (!openSession) return;
    setSessionBusy(true);
    await post(`/api/pos/sessions/${openSession.id}/close`, { counted: Number(counted) || 0, note: closeNote }, "Session closed");
    setSessionBusy(false);
    setCloseDialog(false);
    setCounted("");
    setCloseNote("");
  }

  function charge() {
    const lines = cartLines.map((l) => ({ productId: l.product.id, qty: l.qty }));
    void post(
      "/api/pos/sales",
      { sessionId: openSession?.id, method, lines, memberProfileId: method === "room_charge" ? memberId || undefined : undefined, ref: ref || undefined },
      "Sale recorded",
      (data) => {
        printHints(data);
        setCart({});
        setRef("");
      }
    );
  }

  const printFrame = printUrl ? (
    <iframe
      src={printUrl}
      title="Receipt print"
      style={{ position: "fixed", top: -10000, left: 0, width: 800, height: 800, border: 0 }}
      onLoad={(e) => {
        try {
          (e.currentTarget.contentWindow as Window | null)?.print();
        } catch {
          /* PDF viewer may not expose print(); the receipt link covers manual printing */
        }
        setPrintUrl(null);
      }}
    />
  ) : null;

  return (
    <div>
      {/* ── Session bar ─────────────────────────────────────────────────── */}
      <Card className="mb-4">
        <CardContent className="p-4">
          <div className="flex flex-wrap items-center gap-3">
            <Badge variant={openSession ? "success" : "secondary"}>{openSession ? "session open" : "session closed"}</Badge>
            {openSession ? (
              <>
                <span className="text-sm text-muted-foreground">
                  float {formatMinor(openSession.openingFloatMinor)} · {openSession.sales} sale(s) · cash expected {formatMinor(cashExpected)}
                </span>
                {canWrite ? (
                  <Button size="sm" variant="secondary" className="ml-auto" onClick={() => setCloseDialog(true)} disabled={busy || sessionBusy}>
                    Close session…
                  </Button>
                ) : null}
              </>
            ) : (
              <span className="text-sm text-muted-foreground">
                {property ? `No open session for this property — open one to start ringing up sales.` : "No property in scope."}
              </span>
            )}
            {!openSession && canWrite && property ? (
              <Button size="sm" className="ml-auto" onClick={() => setOpenDialog(true)}>
                Open session…
              </Button>
            ) : null}
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-[1fr_340px]">
        {/* ── Product picker ─────────────────────────────────────────────── */}
        <Card>
          <CardContent className="p-4">
            <div className="flex flex-wrap items-center gap-2">
              <Input
                ref={scanRef}
                className="h-9 max-w-64 font-mono"
                placeholder="Scan / type EAN-13…"
                value={scan}
                disabled={!openSession}
                onChange={(e) => setScan(e.target.value)}
                onKeyDown={handleScan}
              />
              <Input className="h-9 max-w-52" placeholder="Search products…" value={query} onChange={(e) => setQuery(e.target.value)} />
              <div className="ml-auto flex flex-wrap gap-1.5">
                <button
                  className={`rounded-full px-3 py-1 text-xs transition-colors ${!filterCat ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/70"}`}
                  onClick={() => setFilterCat("")}
                >
                  All
                </button>
                {categories.map((c) => (
                  <button
                    key={c}
                    className={`rounded-full px-3 py-1 text-xs transition-colors ${filterCat === c ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/70"}`}
                    onClick={() => setFilterCat(filterCat === c ? "" : c)}
                  >
                    {c}
                  </button>
                ))}
              </div>
            </div>

            {!openSession ? (
              <p className="mt-8 py-10 text-center text-sm text-muted-foreground">Open a session to start ringing up sales.</p>
            ) : visible.length === 0 ? (
              <p className="mt-8 py-10 text-center text-sm text-muted-foreground">No products match — add them under POS Catalog.</p>
            ) : (
              <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-4">
                {visible.map((p) => {
                  const step = p.stock && p.stock.unit !== "pcs" ? 0.5 : 1;
                  const onHand = p.stock ? p.stock.qtyMilli / 1000 : Number.POSITIVE_INFINITY;
                  const sold = cart[p.id] ?? 0;
                  const exhausted = p.stock ? sold + step > onHand + 1e-9 : false;
                  return (
                    <button
                      key={p.id}
                      disabled={!canWrite || exhausted}
                      onClick={() => addToCart(p.id)}
                      className={`group rounded-lg border p-3 text-left transition-colors ${
                        exhausted
                          ? "cursor-not-allowed border-input bg-muted/40 opacity-50"
                          : sold > 0
                            ? "border-primary bg-primary/10 hover:border-primary/70"
                            : "border-input hover:border-primary/50 hover:bg-muted/40"
                      }`}
                    >
                      <span className="block truncate text-sm font-medium">{p.name}</span>
                      <span className="mt-1 block text-sm font-semibold tabular-nums">{formatMinor(p.priceMinor)}</span>
                      <span className="mt-0.5 block text-xs text-muted-foreground">
                        {p.stock
                          ? `${sold > 0 ? `${sold} in tab · ` : ""}${Number.isFinite(onHand) ? `${onHand.toFixed(p.stock.unit === "pcs" ? 0 : 2)} ${p.stock.unit}` : "—"}`
                          : "service"}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* ── Current order ─────────────────────────────────────────────── */}
        <Card>
          <CardContent className="p-4">
            <div className="mb-2 flex items-center justify-between">
              <h2 className="text-sm font-semibold">Current order</h2>
              {cartLines.length > 0 ? (
                <button className="text-xs text-muted-foreground underline underline-offset-4" onClick={() => setCart({})}>
                  clear
                </button>
              ) : null}
            </div>

            {cartLines.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">Tap products to add them.</p>
            ) : (
              <div className="max-h-72 space-y-2 overflow-y-auto pr-1">
                {cartLines.map((l) => (
                  <div key={l.product.id} className="rounded-md border border-input p-2">
                    <div className="flex items-center justify-between gap-2">
                      <span className="truncate text-sm">{l.product.name}</span>
                      <button
                        className="text-xs text-muted-foreground hover:text-destructive"
                        aria-label={`Remove ${l.product.name}`}
                        onClick={() => setQty(l.product.id, 0)}
                      >
                        ✕
                      </button>
                    </div>
                    <div className="mt-1.5 flex items-center gap-2">
                      <button
                        className="flex h-7 w-7 items-center justify-center rounded-md border border-input text-sm"
                        aria-label="Decrease qty"
                        onClick={() => setQty(l.product.id, l.qty - (l.product.stock && l.product.stock.unit !== "pcs" ? 0.5 : 1))}
                      >
                        −
                      </button>
                      <Input
                        className="h-7 w-16 text-center"
                        type="number"
                        min="0"
                        step={l.product.stock && l.product.stock.unit !== "pcs" ? 0.5 : 1}
                        value={l.qty}
                        onChange={(e) => setQty(l.product.id, Number(e.target.value) || 0)}
                      />
                      <button
                        className="flex h-7 w-7 items-center justify-center rounded-md border border-input text-sm"
                        aria-label="Increase qty"
                        onClick={() => addToCart(l.product.id)}
                      >
                        +
                      </button>
                      <span className="ml-auto text-sm font-semibold tabular-nums">{formatMinor(l.product.priceMinor * l.qty)}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="mt-4 space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor="pos-method">Payment</Label>
                <Select id="pos-method" value={method} disabled={!canWrite || !openSession} onChange={(e) => setMethod(e.target.value)}>
                  {Object.entries(METHOD_LABELS).map(([k, v]) => (
                    <option key={k} value={k}>
                      {v}
                    </option>
                  ))}
                </Select>
              </div>
              {method === "room_charge" ? (
                <div className="space-y-1.5">
                  <Label htmlFor="pos-member">Member</Label>
                  <Select id="pos-member" value={memberId} onChange={(e) => setMemberId(e.target.value)}>
                    <option value="">Select a member…</option>
                    {members.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.label}
                      </option>
                    ))}
                  </Select>
                </div>
              ) : (
                <div className="space-y-1.5">
                  <Label htmlFor="pos-ref">Reference {method === "qr" || method === "card" ? "(QR/card)" : ""}</Label>
                  <Input id="pos-ref" value={ref} onChange={(e) => setRef(e.target.value)} maxLength={120} placeholder="optional" />
                </div>
              )}

              <div className="flex items-center justify-between border-t border-border pt-3">
                <span className="text-sm text-muted-foreground">Total</span>
                <span className="text-2xl font-bold tabular-nums">{formatMinor(totalMinor)}</span>
              </div>

              <Button
                size="lg"
                className="w-full"
                disabled={!canWrite || !openSession || busy || cartLines.length === 0 || (method === "room_charge" && !memberId)}
                onClick={charge}
              >
                {method === "room_charge" ? "Charge to room" : `Take ${METHOD_LABELS[method] ?? method}`}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ── Recent sales ────────────────────────────────────────────────── */}
      <Card className="mt-4">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Sale</TableHead>
                <TableHead>Lines</TableHead>
                <TableHead>Paid via</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead>Receipt</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sales.map((s) => (
                <TableRow key={s.id}>
                  <TableCell>
                    <span className="font-mono text-xs">{s.code}</span>
                    <span className="block text-xs text-muted-foreground">{s.createdAt.replace("T", " ").slice(5, 16)}</span>
                  </TableCell>
                  <TableCell className="text-xs">
                    {s.items.map((i) => (
                      <span key={i.id} className="block">
                        {i.qtyMilli % 1000 === 0 ? i.qtyMilli / 1000 : (i.qtyMilli / 1000).toFixed(3)} × {i.name}
                      </span>
                    ))}
                  </TableCell>
                  <TableCell>
                    <Badge variant={s.method === "room_charge" ? "warning" : s.method === "cash" ? "secondary" : "info"}>{s.method.replace("_", " ")}</Badge>
                    {s.memberName ? <span className="block text-xs text-muted-foreground">{s.memberName}</span> : null}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{formatMinor(s.totalMinor)}</TableCell>
                  <TableCell>
                    {s.invoiceId ? (
                      <a href={`/invoices/${s.invoiceId}`} className="text-xs underline underline-offset-4">
                        invoice →
                      </a>
                    ) : (
                      <a href={`/api/pos/sales/${s.id}/receipt`} className="text-xs underline underline-offset-4" target="_blank" rel="noopener">
                        PDF →
                      </a>
                    )}
                  </TableCell>
                </TableRow>
              ))}
              {sales.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="py-8 text-center text-sm text-muted-foreground">
                    No sales yet — open a session and ring one up.
                  </TableCell>
                </TableRow>
              ) : null}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <p className="mt-3 text-xs text-muted-foreground">
        Cash sales raise the expected drawer count; room charges post as one-time lines on the member&apos;s invoice (visible under Invoices).
        Receipts auto-print per Settings → Printers.
      </p>

      {/* ── Open / close dialogs ───────────────────────────────────────── */}
      <Dialog open={openDialog} onClose={() => setOpenDialog(false)} title="Open POS session" description="Set the opening cash float for the drawer.">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void doOpenSession();
          }}
          className="space-y-4"
        >
          <div className="space-y-1.5">
            <Label htmlFor="pos-float">Opening float</Label>
            <Input id="pos-float" type="number" step="0.01" min="0" value={float} onChange={(e) => setFloat(e.target.value)} required />
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setOpenDialog(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={sessionBusy}>
              Open session
            </Button>
          </div>
        </form>
      </Dialog>

      <Dialog open={closeDialog} onClose={() => setCloseDialog(false)} title="Close POS session" description={`Expected cash in drawer: ${formatMinor(cashExpected)} (float + cash sales). Count what is in the drawer.`}>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void doCloseSession();
          }}
          className="space-y-4"
        >
          <div className="space-y-1.5">
            <Label htmlFor="pos-counted">Counted cash</Label>
            <Input id="pos-counted" type="number" step="0.01" min="0" value={counted} onChange={(e) => setCounted(e.target.value)} required />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="pos-note">Close note</Label>
            <Input id="pos-note" value={closeNote} onChange={(e) => setCloseNote(e.target.value)} maxLength={300} placeholder="explanation for any variance (required practice)" />
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setCloseDialog(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={sessionBusy}>
              Close session
            </Button>
          </div>
        </form>
      </Dialog>

      {printFrame}
    </div>
  );
}