"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Input, Label, Select, Textarea } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { PhotoCell } from "@/components/photo-cell";
import { formatMinor } from "@/lib/money";
import { useToast } from "@/components/toast";
import { Tx } from "@/components/i18n-text";

export type ClientProduct = {
  id: string;
  name: string;
  priceMinor: number;
  category: string | null;
  categoryId: string | null;
  barcode: string | null;
  sku: string | null;
  description: string | null;
  isActive: boolean;
  imageDocId?: string | null;
  stock: { id: string; name: string; qtyMilli: number; unit: string } | null;
};

interface Props {
  products: ClientProduct[];
  stockItems: { id: string; label: string }[];
  categories: { value: string; label: string }[];
  legacyCategories: string[];
  canWrite: boolean;
}

const emptyForm = { id: "", name: "", price: "", category: "", categoryId: "", barcode: "", sku: "", description: "", stockItemId: "", isActive: true };

export function ProductsClient({ products, stockItems, categories, legacyCategories, canWrite }: Props) {
  const router = useRouter();
  const { push } = useToast();
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [editing, setEditing] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [printCategory, setPrintCategory] = useState("");
  const isNew = form.id === "";
  const stockMap = new Map(stockItems.map((s) => [s.id, s.label]));

  function startNew() {
    setForm(emptyForm);
    setEditing(true);
  }
  function startEdit(p: ClientProduct) {
    setForm({
      id: p.id,
      name: p.name,
      price: (p.priceMinor / 100).toFixed(2),
      category: p.category ?? "",
      categoryId: p.categoryId ?? "",
      barcode: p.barcode ?? "",
      sku: p.sku ?? "",
      description: p.description ?? "",
      stockItemId: p.stock?.id ?? "",
      isActive: p.isActive
    });
    setEditing(true);
  }

  async function save() {
    setBusy(true);
    const method = isNew ? "POST" : "PATCH";
    const url = isNew ? "/api/pos/products" : `/api/pos/products?id=${form.id}`;
    const body: Record<string, unknown> = {
      name: form.name,
      price: Number(form.price),
      categoryId: form.categoryId || null,
      barcode: form.barcode || null,
      sku: form.sku || null,
      description: form.description || null,
      stockItemId: form.stockItemId || null
    };
    if (!isNew) body.isActive = form.isActive;
    const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const data = (await res.json().catch(() => ({}))) as { message?: string };
    setBusy(false);
    if (!res.ok) {
      push({ title: "Failed", description: data.message ?? "Could not save product", variant: "destructive" });
      return;
    }
    push({ title: isNew ? "Product created" : "Product updated", variant: "success" });
    setEditing(false);
    router.refresh();
  }

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function openLabelSheet(copies: number) {
    const q = new URLSearchParams();
    if (selected.size > 0) q.set("ids", [...selected].join(","));
    else q.set("ids", products.map((p) => p.id).join(","));
    q.set("copies", String(copies));
    if (printCategory) q.set("category", printCategory);
    window.open(`/api/pos/products/label?${q.toString()}`, "_blank", "noopener,noreferrer");
  }

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2">
        {canWrite && (
          <Button size="sm" onClick={startNew}>
            New product…
          </Button>
        )}
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <Select className="h-9 w-44" value={printCategory} onChange={(e) => setPrintCategory(e.target.value)}>
            <option value=""><Tx>All categories</Tx></option>
            {legacyCategories.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </Select>
          <Button size="sm" variant="outline" disabled={!products.length} onClick={() => openLabelSheet(1)}>
            Print labels (×1)
          </Button>
          <Button size="sm" variant="outline" disabled={!products.length} onClick={() => openLabelSheet(6)}>
            Print labels (×6)
          </Button>
        </div>
      </div>
      <p className="mt-2 text-xs text-muted-foreground">
        {selected.size > 0
          ? `${selected.size} product(s) selected — printing will use only those.`
          : "Labels print for all products (or the selected category). Tick rows to print a subset."}
      </p>

      <Card className="mt-4">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-8"></TableHead>
                <TableHead>Photo</TableHead>
                <TableHead>Product</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Barcode / SKU</TableHead>
                <TableHead className="text-right">Price</TableHead>
                <TableHead>Stock</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Label</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {products.map((p) => (
                <TableRow key={p.id}>
                  <TableCell>
                    <input type="checkbox" checked={selected.has(p.id)} onChange={() => toggle(p.id)} aria-label={`Select ${p.name}`} />
                  </TableCell>
                  <TableCell>
                    <PhotoCell
                      getUrl={`/api/pos/products/${p.id}/image`}
                      uploadUrl={`/api/pos/products/${p.id}/image`}
                      alt={p.name}
                      canWrite={canWrite}
                    />
                  </TableCell>
                  <TableCell>
                    <span className="text-sm font-medium">{p.name}</span>
                    {p.description ? <span className="block max-w-[30ch] truncate text-xs text-muted-foreground">{p.description}</span> : null}
                    {canWrite ? (
                      <button className="block text-xs text-muted-foreground underline underline-offset-4" onClick={() => startEdit(p)}>
                        <Tx>edit
                      </Tx></button>
                    ) : null}
                  </TableCell>
                  <TableCell>{p.category ? <Badge variant="outline">{p.category}</Badge> : <span className="text-xs text-muted-foreground">—</span>}</TableCell>
                  <TableCell className="font-mono text-xs">
                    {p.barcode ?? <span className="text-muted-foreground">—</span>}
                    {p.sku ? <span className="block text-muted-foreground"><Tx>SKU </Tx>{p.sku}</span> : null}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{formatMinor(p.priceMinor)}</TableCell>
                  <TableCell className="text-xs">
                    {p.stock ? `${(p.stock.qtyMilli / 1000).toFixed(p.stock.unit === "pcs" ? 0 : 2)} ${p.stock.unit}` : <span className="text-muted-foreground"><Tx>service</Tx></span>}
                  </TableCell>
                  <TableCell>
                    <Badge variant={p.isActive ? "success" : "secondary"}>{p.isActive ? "active" : "hidden"}</Badge>
                  </TableCell>
                  <TableCell className="text-right text-xs">
                    <a className="underline underline-offset-4" href={`/api/pos/products/label?ids=${p.id}&copies=1&p=0`} target="_blank" rel="noopener noreferrer">
                      <Tx>print
                    </Tx></a>
                  </TableCell>
                </TableRow>
              ))}
              {products.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} className="py-8 text-center text-sm text-muted-foreground"><Tx>
                    No products yet — add one from the button above.
                  </Tx></TableCell>
                </TableRow>
              ) : null}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={editing} onClose={() => setEditing(false)} title={isNew ? "New product" : `Edit ${form.name}`} description="EAN-13 barcodes are auto-validated (12 digits get a check digit)." wide>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void save();
          }}
          className="space-y-4"
        >
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="pp-name">Name</Label>
              <Input id="pp-name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required minLength={2} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="pp-price">Price</Label>
              <Input id="pp-price" type="number" step="0.01" min="0" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} required />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="pp-category">Category</Label>
              <Select id="pp-category" value={form.categoryId} onChange={(e) => setForm({ ...form, categoryId: e.target.value })}>
                <option value=""><Tx>— uncategorized —</Tx></option>
                {categories.map((c) => (
                  <option key={c.value} value={c.value}>
                    {c.label}
                  </option>
                ))}
              </Select>
              {form.categoryId ? (
                <p className="text-xs text-muted-foreground"><Tx>Saved as: </Tx>{categories.find((c) => c.value === form.categoryId)?.label.trim() ?? form.category}</p>
              ) : form.category ? (
                <p className="text-xs text-muted-foreground"><Tx>Legacy category string: </Tx>{form.category}</p>
              ) : null}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="pp-barcode">Barcode (EAN-13)</Label>
              <Input id="pp-barcode" value={form.barcode} onChange={(e) => setForm({ ...form, barcode: e.target.value })} maxLength={32} placeholder="12 or 13 digits" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="pp-sku">SKU</Label>
              <Input id="pp-sku" value={form.sku} onChange={(e) => setForm({ ...form, sku: e.target.value })} maxLength={40} />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="pp-description">Description</Label>
              <Textarea id="pp-description" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={2} maxLength={500} />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="pp-stock">Stock item</Label>
              <Select id="pp-stock" value={form.stockItemId} onChange={(e) => setForm({ ...form, stockItemId: e.target.value })}>
                <option value=""><Tx>— service / not linked —</Tx></option>
                {stockItems.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.label}
                  </option>
                ))}
              </Select>
              {form.stockItemId && stockMap.get(form.stockItemId) ? <p className="text-xs text-muted-foreground"><Tx>Linked stock: </Tx>{stockMap.get(form.stockItemId)}</p> : null}
            </div>
            {!isNew ? (
              <label className="flex items-center gap-2 text-sm sm:col-span-2">
                <input type="checkbox" checked={form.isActive} onChange={(e) => setForm({ ...form, isActive: e.target.checked })} />
                <Tx>Active (visible at the till and on labels)
              </Tx></label>
            ) : null}
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setEditing(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={busy || form.name.trim().length < 2 || !Number(form.price)}>
              {isNew ? "Create product" : "Save changes"}
            </Button>
          </div>
        </form>
      </Dialog>
    </div>
  );
}