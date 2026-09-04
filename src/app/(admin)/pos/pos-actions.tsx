"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Input, Label, Select, Textarea } from "@/components/ui/input";
import { useToast } from "@/components/toast";

interface Props {
  mode: "open" | "close" | "sale";
  propertyId?: string;
  sessionId?: string;
  expectedCashMinor?: number;
  products?: { id: string; label: string; unit: string; qty: number }[];
  members?: { id: string; label: string }[];
}

export function PosActions({ mode, propertyId, sessionId, expectedCashMinor, products = [], members = [] }: Props) {
  const router = useRouter();
  const { push } = useToast();
  const [busy, setBusy] = useState(false);

  async function post(url: string, body: unknown, okTitle: string, onDone?: () => void) {
    setBusy(true);
    const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const data = (await res.json().catch(() => ({}))) as { message?: string; code?: string; codeText?: string; varianceMinor?: number; expectedCashMinor?: number };
    setBusy(false);
    if (!res.ok) {
      push({ title: "Failed", description: data.message ?? data.code, variant: "destructive" });
      return;
    }
    const variance = (data as { varianceMinor?: number }).varianceMinor;
    push({
      title: okTitle,
      description: variance != null ? `variance ${variance >= 0 ? "+" : ""}${(variance / 100).toFixed(2)}` : undefined,
      variant: "success"
    });
    onDone?.();
    router.refresh();
  }

  if (mode === "open") {
    return (
      <OpenDialog busy={busy} onDone={(float) => post("/api/pos/sessions", { propertyId, float }, "Session opened")} />
    );
  }
  if (mode === "close") {
    return <CloseDialog busy={busy} expectedCashMinor={expectedCashMinor!} onDone={(counted, note) => post(`/api/pos/sessions/${sessionId}/close`, { counted, note }, "Session closed")} />;
  }
  return <SaleDialog busy={busy} sessionId={sessionId!} products={products} members={members} onDone={(payload) => post("/api/pos/sales", payload, "Sale recorded")} />;
}

function OpenDialog({ busy, onDone }: { busy: boolean; onDone: (float: number) => Promise<void> }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button size="sm" onClick={() => setOpen(true)}>
        Open session…
      </Button>
      <Dialog open={open} onClose={() => setOpen(false)} title="Open POS session" description="Set the opening cash float for the drawer.">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const fd = new FormData(e.currentTarget);
            void onDone(Number(fd.get("float") ?? 0)).then(() => setOpen(false));
          }}
          className="space-y-4"
        >
          <div className="space-y-1.5">
            <Label htmlFor="ps-float">Opening float</Label>
            <Input id="ps-float" name="float" type="number" step="0.01" min="0" defaultValue={0} required />
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={busy}>
              Open session
            </Button>
          </div>
        </form>
      </Dialog>
    </>
  );
}

function CloseDialog({ busy, expectedCashMinor, onDone }: { busy: boolean; expectedCashMinor: number; onDone: (counted: number, note: string) => Promise<void> }) {
  const [open, setOpen] = useState(false);
  const [counted, setCounted] = useState("");
  const variance = counted === "" ? null : Math.round(Number(counted) * 100) - expectedCashMinor;
  return (
    <>
      <Button size="sm" variant="secondary" onClick={() => setOpen(true)}>
        Close session…
      </Button>
      <Dialog open={open} onClose={() => setOpen(false)} title="Close POS session" description={`Expected cash in drawer: ${(expectedCashMinor / 100).toFixed(2)} (float + cash sales). Count what is in the drawer.`}>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void onDone(Number(counted), String((e.currentTarget.elements.namedItem("note") as HTMLInputElement)?.value ?? "")).then(() => setOpen(false));
          }}
          className="space-y-4"
        >
          <div className="space-y-1.5">
            <Label htmlFor="ps-counted">Counted cash</Label>
            <Input id="ps-counted" name="counted" type="number" step="0.01" min="0" value={counted} onChange={(e) => setCounted(e.target.value)} required />
            {variance != null ? (
              <p className={`rounded-md p-2 text-xs ${variance === 0 ? "bg-muted" : variance > 0 ? "bg-green-500/10 text-green-700" : "bg-destructive/10 text-destructive"}`}>
                Variance: {variance >= 0 ? "+" : ""}
                {(variance / 100).toFixed(2)}
              </p>
            ) : null}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ps-note">Close note</Label>
            <Textarea id="ps-note" name="note" rows={2} maxLength={300} placeholder="explanation for any variance (required practice)" />
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={busy}>
              Close session
            </Button>
          </div>
        </form>
      </Dialog>
    </>
  );
}

function SaleDialog({
  busy,
  sessionId,
  products,
  members,
  onDone
}: {
  busy: boolean;
  sessionId: string;
  products: { id: string; label: string; unit: string; qty: number }[];
  members: { id: string; label: string }[];
  onDone: (payload: Record<string, unknown>) => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [cart, setCart] = useState<Record<string, number>>({});
  const [method, setMethod] = useState("cash");

  const lines = Object.entries(cart)
    .filter(([, qty]) => qty > 0)
    .map(([productId, qty]) => ({ productId, qty }));
  const total = lines.reduce((sum, l) => {
    const p = products.find((x) => x.id === l.productId);
    return sum + (p ? l.qty : 0) * 0; // price lives in the label; server computes the true total
  }, 0);
  void total;

  return (
    <>
      <Button size="sm" onClick={() => setOpen(true)}>
        New sale…
      </Button>
      <Dialog open={open} onClose={() => setOpen(false)} title="Record sale" description="Quantities in the product's unit. Cash/QR/card settle now; room charge posts the total to the member's account." wide>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const fd = new FormData(e.currentTarget);
            void onDone({
              sessionId,
              method: String(fd.get("method")),
              lines,
              memberProfileId: method === "room_charge" ? String(fd.get("memberProfileId")) : undefined,
              ref: String(fd.get("ref") ?? "") || undefined
            }).then(() => {
              setCart({});
              setOpen(false);
            });
          }}
          className="space-y-4"
        >
          <div className="max-h-64 space-y-2 overflow-y-auto">
            {products.map((p) => (
              <div key={p.id} className="grid grid-cols-12 items-center gap-2">
                <span className="col-span-9 truncate text-sm">
                  {p.label}
                  <span className="text-muted-foreground"> · {p.qty} on hand</span>
                </span>
                <Input
                  className="col-span-3"
                  type="number"
                  step={p.unit === "pcs" ? "1" : "0.001"}
                  min="0"
                  max={p.qty}
                  placeholder={p.unit}
                  value={cart[p.id] ?? ""}
                  onChange={(e) => setCart((c) => ({ ...c, [p.id]: Number(e.target.value) || 0 }))}
                />
              </div>
            ))}
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="space-y-1.5">
              <Label htmlFor="ps-method">Payment</Label>
              <Select id="ps-method" name="method" value={method} onChange={(e) => setMethod(e.target.value)} required>
                <option value="cash">cash</option>
                <option value="qr">QR</option>
                <option value="card">card</option>
                <option value="room_charge">charge to room</option>
              </Select>
            </div>
            {method === "room_charge" ? (
              <div className="space-y-1.5">
                <Label htmlFor="ps-member">Member</Label>
                <Select id="ps-member" name="memberProfileId" defaultValue={members[0]?.id} required>
                  {members.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.label}
                    </option>
                  ))}
                </Select>
              </div>
            ) : (
              <div className="space-y-1.5">
                <Label htmlFor="ps-ref">Reference (QR/card)</Label>
                <Input id="ps-ref" name="ref" maxLength={120} placeholder="optional" />
              </div>
            )}
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={busy || lines.length === 0}>
              Record sale
            </Button>
          </div>
        </form>
      </Dialog>
    </>
  );
}
