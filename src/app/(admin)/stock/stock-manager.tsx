"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog } from "@/components/ui/dialog";
import { Input, Label, Select } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/components/toast";
import { formatMinor } from "@/lib/money";
import { flattenCategoryTree, type CategoryNode } from "@/lib/stock/categories";

export interface StockItemRow {
  id: string;
  name: string;
  category: string;
  unit: string;
  packUnit: string | null;
  packSize: number | null;
  qtyMilli: number;
  avgCostMilli: number;
  minQtyMilli: number;
  supplierId: string | null;
  supplierName: string | null;
  propertyCode: string;
  isActive: boolean;
}

export interface MovementRow {
  id: string;
  createdAt: string;
  itemName: string;
  qtyMilli: number;
  qtyAfterMilli: number;
  unit: string;
  type: string;
  saleCode: string | null;
  note: string | null;
}

export interface StocktakeRow {
  id: string;
  code: string;
  createdAt: string;
  valueDeltaMilli: number;
  lines: { itemName: string; expectedMilli: number; countedMilli: number }[];
}

interface Props {
  items: StockItemRow[];
  categories: CategoryNode[];
  suppliers: { id: string; label: string }[];
  properties: { id: string; code: string }[];
  units: string[];
  movements: MovementRow[];
  stocktakes: StocktakeRow[];
  canWrite: boolean;
}

type Tab = "items" | "categories" | "movements" | "stocktakes";

const TABS: { key: Tab; label: string }[] = [
  { key: "items", label: "Items" },
  { key: "categories", label: "Categories" },
  { key: "movements", label: "Movements" },
  { key: "stocktakes", label: "Stocktakes" }
];

async function send(url: string, method: string, body: unknown): Promise<{ ok: boolean; message?: string }> {
  const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const data = (await res.json().catch(() => ({}))) as { message?: string };
  return { ok: res.ok, message: data.message };
}

export function StockManager({ items, categories, suppliers, properties, units, movements, stocktakes, canWrite }: Props) {
  const router = useRouter();
  const { push } = useToast();
  const [tab, setTab] = useState<Tab>("items");
  const [search, setSearch] = useState("");
  const [catFilter, setCatFilter] = useState("");
  const [lowOnly, setLowOnly] = useState(false);
  const [editItem, setEditItem] = useState<StockItemRow | "new" | null>(null);
  const [catDialog, setCatDialog] = useState<{ action: "create" | "edit"; parentId?: string; category?: CategoryNode } | null>(null);
  const [busy, setBusy] = useState(false);

  const flatCats = useMemo(() => flattenCategoryTree(categories), [categories]);
  const catOptions = useMemo(() => flatCats.map((c) => ({ value: c.id, label: `${"　".repeat(c.depth)}${c.path}` })), [flatCats]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return items.filter((i) => {
      if (lowOnly && !(i.qtyMilli <= i.minQtyMilli)) return false;
      if (q && !`${i.name} ${i.category} ${i.supplierName ?? ""}`.toLowerCase().includes(q)) return false;
      if (catFilter && !(i.category === catFilter || i.category.startsWith(`${catFilter}/`))) return false;
      return true;
    });
  }, [items, search, catFilter, lowOnly]);

  const totalValueMinor = items.reduce((s, i) => s + Math.round((i.qtyMilli * i.avgCostMilli) / 1000), 0);
  const lowCount = items.filter((i) => i.qtyMilli <= i.minQtyMilli).length;

  async function saveItem(body: unknown) {
    if (!editItem) return;
    setBusy(true);
    const r = await send(editItem === "new" ? "/api/stock/items" : `/api/stock/items?id=${editItem.id}`, editItem === "new" ? "POST" : "PATCH", body);
    setBusy(false);
    push(r.ok ? { title: editItem === "new" ? "Item created" : "Item updated", variant: "success" } : { title: "Failed", description: r.message, variant: "destructive" });
    if (r.ok) {
      setEditItem(null);
      router.refresh();
    }
  }

  async function saveCategory(action: "create" | "edit", body: unknown) {
    setBusy(true);
    const r = action === "create" ? await send("/api/stock/categories", "POST", body) : await send(`/api/stock/categories/${catDialog?.category?.id}`, "PATCH", body);
    setBusy(false);
    push(r.ok ? { title: action === "create" ? "Category created" : "Category updated", variant: "success" } : { title: "Failed", description: r.message, variant: "destructive" });
    if (r.ok) {
      setCatDialog(null);
      router.refresh();
    }
  }

  async function deleteCategory(c: CategoryNode) {
    setBusy(true);
    const r = await send(`/api/stock/categories/${c.id}`, "DELETE", {});
    setBusy(false);
    push(r.ok ? { title: "Category deleted", variant: "success" } : { title: "Cannot delete", description: r.message, variant: "destructive" });
    if (r.ok) router.refresh();
  }

  return (
    <div>
      <div className="mb-4 flex flex-wrap gap-3 text-sm">
        <Badge variant="outline">items: {items.length}</Badge>
        <Badge variant={lowCount > 0 ? "warning" : "success"}>low stock: {lowCount}</Badge>
        <Badge variant="info">valuation: {formatMinor(totalValueMinor)}</Badge>
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-1 rounded-lg border bg-muted/40 p-1">
        {TABS.map((t) => (
          <button
            key={t.key}
            className={`rounded-md px-3 py-1.5 text-sm font-medium ${tab === t.key ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
            onClick={() => setTab(t.key)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "items" ? (
        <>
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <Input className="max-w-64" placeholder="Search name, category, supplier…" value={search} onChange={(e) => setSearch(e.target.value)} />
            <Select className="max-w-48" value={catFilter} onChange={(e) => setCatFilter(e.target.value)}>
              <option value="">All categories</option>
              {catOptions.map((c) => (
                <option key={c.value} value={c.label.trim()}>
                  {c.label}
                </option>
              ))}
            </Select>
            <label className="flex items-center gap-1.5 text-xs">
              <input type="checkbox" checked={lowOnly} onChange={(e) => setLowOnly(e.target.checked)} /> low only
            </label>
          </div>

          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Item</TableHead>
                    <TableHead>Supplier</TableHead>
                    <TableHead className="text-right">On hand</TableHead>
                    <TableHead className="text-right">Low</TableHead>
                    <TableHead className="text-right">Avg cost</TableHead>
                    <TableHead className="text-right">Value</TableHead>
                    {canWrite ? <TableHead /> : null}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((i) => {
                    const low = i.qtyMilli <= i.minQtyMilli;
                    return (
                      <TableRow key={i.id} className={i.isActive ? "" : "opacity-50"}>
                        <TableCell>
                          {i.name}
                          <span className="block text-xs text-muted-foreground">
                            {i.category || "uncategorized"} · per {i.unit}
                            {i.packUnit && i.packSize ? ` · 1 ${i.packUnit} = ${i.packSize} ${i.unit}` : ""} · {i.propertyCode}
                            {!i.isActive ? " · archived" : ""}
                          </span>
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">{i.supplierName ?? "—"}</TableCell>
                        <TableCell className="text-right tabular-nums">
                          {i.qtyMilli / 1000}
                          {low ? (
                            <Badge variant="warning" className="ml-2">
                              low
                            </Badge>
                          ) : null}
                        </TableCell>
                        <TableCell className="text-right tabular-nums text-xs">{i.minQtyMilli > 0 ? i.minQtyMilli / 1000 : "—"}</TableCell>
                        <TableCell className="text-right tabular-nums text-xs">{i.avgCostMilli > 0 ? formatMinor(Math.round(i.avgCostMilli / 1000)) : "—"}</TableCell>
                        <TableCell className="text-right tabular-nums">{formatMinor(Math.round((i.qtyMilli * i.avgCostMilli) / 1000))}</TableCell>
                        {canWrite ? (
                          <TableCell className="text-right">
                            <Button size="sm" variant="ghost" onClick={() => setEditItem(i)}>
                              Edit
                            </Button>
                          </TableCell>
                        ) : null}
                      </TableRow>
                    );
                  })}
                  {filtered.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={canWrite ? 8 : 7} className="py-8 text-center text-sm text-muted-foreground">
                        No stock items match.
                      </TableCell>
                    </TableRow>
                  ) : null}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </>
      ) : null}

      {tab === "categories" ? (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            {canWrite ? (
              <Button size="sm" onClick={() => setCatDialog({ action: "create" })}>
                New category…
              </Button>
            ) : null}
            <p className="text-xs text-muted-foreground">
              Two levels (parent/child · shared or per property). Deleting a category in use is refused — archive it instead.
            </p>
          </div>
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Category</TableHead>
                    <TableHead className="text-right">Items</TableHead>
                    <TableHead>Scope</TableHead>
                    <TableHead>Status</TableHead>
                    {canWrite ? <TableHead /> : null}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {flatCats.map((c) => (
                    <TableRow key={c.id} className={c.isActive ? "" : "opacity-50"}>
                      <TableCell style={{ paddingLeft: 14 + c.depth * 20 }}>
                        <span className="font-medium">{c.name}</span>
                        {c.parentId ? <span className="text-xs text-muted-foreground"> · {c.path.replace(` / ${c.name}`, "")}</span> : null}
                      </TableCell>
                      <TableCell className="text-right tabular-nums text-xs">{c.itemCount ?? 0}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {c.propertyId ? properties.find((p) => p.id === c.propertyId)?.code ?? c.propertyId : "shared"}
                      </TableCell>
                      <TableCell>{c.isActive ? <Badge variant="success">active</Badge> : <Badge variant="secondary">archived</Badge>}</TableCell>
                      {canWrite ? (
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1">
                            {c.depth === 0 && c.isActive ? (
                              <Button size="sm" variant="ghost" onClick={() => setCatDialog({ action: "create", parentId: c.id })}>
                                +child
                              </Button>
                            ) : null}
                            <Button size="sm" variant="ghost" onClick={() => setCatDialog({ action: "edit", category: c })}>
                              Edit
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="text-destructive"
                              disabled={busy}
                              onClick={() => {
                                if (window.confirm(`Delete category "${c.path}"? Only empty categories can be deleted.`)) void deleteCategory(c);
                              }}
                            >
                              Delete
                            </Button>
                          </div>
                        </TableCell>
                      ) : null}
                    </TableRow>
                  ))}
                  {flatCats.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={canWrite ? 5 : 4} className="py-8 text-center text-sm text-muted-foreground">
                        No categories yet — create one to organise items & till products.
                      </TableCell>
                    </TableRow>
                  ) : null}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>
      ) : null}

      {tab === "movements" ? (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>When</TableHead>
                  <TableHead>Item</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead className="text-right">Δ qty</TableHead>
                  <TableHead className="text-right">After</TableHead>
                  <TableHead>Note</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {movements.map((m) => (
                  <TableRow key={m.id}>
                    <TableCell className="text-xs text-muted-foreground">{m.createdAt.slice(5, 16).replace("T", " ")}</TableCell>
                    <TableCell className="text-xs">{m.itemName}</TableCell>
                    <TableCell>
                      <Badge variant={m.qtyMilli >= 0 ? "success" : "secondary"}>{m.type}</Badge>
                      {m.saleCode ? <span className="block text-xs text-muted-foreground">{m.saleCode}</span> : null}
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-xs">
                      {m.qtyMilli > 0 ? "+" : ""}
                      {m.qtyMilli / 1000} {m.unit}
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-xs">{m.qtyAfterMilli / 1000}</TableCell>
                    <TableCell className="max-w-64 truncate text-xs text-muted-foreground">{m.note ?? "—"}</TableCell>
                  </TableRow>
                ))}
                {movements.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="py-8 text-center text-sm text-muted-foreground">
                      No movements yet.
                    </TableCell>
                  </TableRow>
                ) : null}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      ) : null}

      {tab === "stocktakes" ? (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Take</TableHead>
                  <TableHead>Lines</TableHead>
                  <TableHead>Variances</TableHead>
                  <TableHead className="text-right">Valuation Δ</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {stocktakes.map((t) => (
                  <TableRow key={t.id}>
                    <TableCell>
                      <span className="font-mono text-xs">{t.code}</span>
                      <span className="block text-xs text-muted-foreground">{t.createdAt.slice(0, 10)}</span>
                    </TableCell>
                    <TableCell className="text-xs">
                      {t.lines.map((l) => (
                        <span key={`${t.id}-${l.itemName}`} className="block">
                          {l.itemName}: expected {l.expectedMilli / 1000} → counted {l.countedMilli / 1000}
                          {l.expectedMilli !== l.countedMilli ? <Badge variant={l.countedMilli > l.expectedMilli ? "success" : "warning"} className="ml-1">{l.countedMilli > l.expectedMilli ? "+" : ""}{(l.countedMilli - l.expectedMilli) / 1000}</Badge> : null}
                        </span>
                      ))}
                    </TableCell>
                    <TableCell className="text-xs">{t.lines.filter((l) => l.expectedMilli !== l.countedMilli).length}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatMinor(Math.round(t.valueDeltaMilli / 1000))}</TableCell>
                  </TableRow>
                ))}
                {stocktakes.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="py-8 text-center text-sm text-muted-foreground">
                      No stocktakes yet.
                    </TableCell>
                  </TableRow>
                ) : null}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      ) : null}

      {editItem ? (
        <ItemDialog
          item={editItem}
          categories={catOptions}
          suppliers={suppliers}
          properties={properties}
          units={units}
          busy={busy}
          onClose={() => setEditItem(null)}
          onSave={saveItem}
        />
      ) : null}

      {catDialog ? (
        <CategoryDialog
          action={catDialog.action}
          category={catDialog.category}
          parentId={catDialog.parentId}
          categories={catOptions}
          properties={properties}
          busy={busy}
          onClose={() => setCatDialog(null)}
          onSave={(body) => saveCategory(catDialog.action, body)}
        />
      ) : null}
    </div>
  );
}

function ItemDialog({
  item,
  categories,
  suppliers,
  properties,
  units,
  busy,
  onClose,
  onSave
}: {
  item: StockItemRow | "new";
  categories: { value: string; label: string }[];
  suppliers: { id: string; label: string }[];
  properties: { id: string; code: string }[];
  units: string[];
  busy: boolean;
  onClose: () => void;
  onSave: (b: Record<string, unknown>) => Promise<void>;
}) {
  const isNew = item === "new";
  const [name, setName] = useState(item === "new" ? "" : item.name);
  const [catValue, setCatValue] = useState<string>("");
  const [unit, setUnit] = useState(item === "new" ? "" : item.unit);
  const [packUnit, setPackUnit] = useState(item === "new" ? "" : item.packUnit ?? "");
  const [packSize, setPackSize] = useState(item === "new" ? "" : item.packSize ? String(item.packSize) : "");
  const [minQty, setMinQty] = useState(item === "new" ? "0" : String((item.minQtyMilli / 1000).toFixed(3)));
  const [supplierId, setSupplierId] = useState(item === "new" ? "" : item.supplierId ?? "");
  const [isActive, setIsActive] = useState(item === "new" ? true : item.isActive);

  return (
    <Dialog open onClose={onClose} title={isNew ? "New stock item" : `Edit "${item.name}"`} description={isNew ? "Starts at zero on-hand — purchase to add stock." : "Metadata only — quantities change only via movements."}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void onSave({
            name,
            categoryId: catValue || undefined,
            unit,
            packUnit: packUnit || null,
            packSize: packSize ? Number(packSize) : null,
            minQty: Number(minQty) || 0,
            supplierId: supplierId || undefined,
            ...(isNew ? { propertyId: properties[0]?.id } : { isActive })
          });
        }}
        className="space-y-4"
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label>Name</Label>
            <Input value={name} minLength={2} maxLength={120} required onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Category</Label>
            <Select value={catValue} onChange={(e) => setCatValue(e.target.value)}>
              <option value="">— uncategorized</option>
              {categories.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label}
                </option>
              ))}
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Unit</Label>
            <Input value={unit} maxLength={20} list="edit-unit-options" required onChange={(e) => setUnit(e.target.value)} />
            <datalist id="edit-unit-options">
              {units.map((u) => (
                <option key={u} value={u} />
              ))}
            </datalist>
          </div>
          <div className="space-y-1.5">
            <Label>Low-stock threshold</Label>
            <Input type="number" step="0.001" min="0" value={minQty} onChange={(e) => setMinQty(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Pack unit (optional)</Label>
            <Input value={packUnit} maxLength={20} list="edit-pack-unit-options" placeholder="e.g. carton" onChange={(e) => setPackUnit(e.target.value)} />
            <datalist id="edit-pack-unit-options">
              {units.map((u) => (
                <option key={u} value={u} />
              ))}
            </datalist>
          </div>
          <div className="space-y-1.5">
            <Label>1 pack = how many {unit.trim() || "units"}?</Label>
            <Input type="number" step="1" min="2" value={packSize} placeholder="e.g. 12" onChange={(e) => setPackSize(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Supplier</Label>
            <Select value={supplierId} onChange={(e) => setSupplierId(e.target.value)}>
              <option value="">—</option>
              {suppliers.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.label}
                </option>
              ))}
            </Select>
          </div>
          {!isNew ? (
            <label className="flex items-center gap-2 pt-6 text-sm">
              <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} />
              Active (archived hides from new selections & deactivates low-stock)
            </label>
          ) : null}
        </div>
        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={busy}>
            {isNew ? "Create item" : "Save"}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}

function CategoryDialog({
  action,
  category,
  parentId,
  categories,
  properties,
  busy,
  onClose,
  onSave
}: {
  action: "create" | "edit";
  category?: CategoryNode;
  parentId?: string;
  categories: { value: string; label: string }[];
  properties: { id: string; code: string }[];
  busy: boolean;
  onClose: () => void;
  onSave: (b: Record<string, unknown>) => Promise<void>;
}) {
  const isNew = action === "create";
  const [name, setName] = useState(category?.name ?? "");
  const [parent, setParent] = useState<string>(category?.parentId ?? parentId ?? "");
  const [propertyId, setPropertyId] = useState<string>(category?.propertyId ?? properties[0]?.id ?? "");
  const [isActive, setIsActive] = useState(category?.isActive ?? true);

  return (
    <Dialog open onClose={onClose} title={isNew ? "New category" : `Edit "${category?.name}"`} description={isNew ? "Categories organise stock items and POS products." : "Rename, move to a different parent (two levels max), or archive."}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          const body: Record<string, unknown> = { name };
          if (isNew) {
            body.parentId = parent || null;
            body.propertyId = propertyId || null;
          } else {
            if (parent !== category?.parentId) body.parentId = parent || null;
            if (isActive !== category?.isActive) body.isActive = isActive;
          }
          void onSave(body);
        }}
        className="space-y-4"
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label>Name</Label>
            <Input value={name} minLength={2} maxLength={60} required onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>{isNew ? "Parent (optional)" : "Parent"}</Label>
            <Select value={parent} onChange={(e) => setParent(e.target.value)}>
              <option value="">— root</option>
              {categories
                .filter((c) => c.value !== category?.id)
                .map((c) => (
                  <option key={c.value} value={c.value}>
                    {c.label}
                  </option>
                ))}
            </Select>
          </div>
          {isNew ? (
            <div className="space-y-1.5">
              <Label>Scope</Label>
              <Select value={propertyId} onChange={(e) => setPropertyId(e.target.value)}>
                <option value="">Shared (all properties / till)</option>
                {properties.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.code}
                  </option>
                ))}
              </Select>
            </div>
          ) : (
            <label className="flex items-center gap-2 pt-6 text-sm">
              <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} />
              Active
            </label>
          )}
        </div>
        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={busy}>
            {isNew ? "Create" : "Save"}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}