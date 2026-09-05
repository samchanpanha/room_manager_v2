/// M15/M14 category hierarchy helpers (pure — no DB). Categories are
/// optional parent/child (two levels); `propertyId = null` categories are
/// shared across all properties (used by the POS catalogue).

export interface CategoryNode {
  id: string;
  name: string;
  parentId: string | null;
  propertyId: string | null;
  sortOrder: number;
  isActive: boolean;
  itemCount?: number;
}

export interface FlatCategoryNode extends CategoryNode {
  depth: number;
  path: string; // "Beverages / Cold" — the denormalized snapshot stored on items/products
}

/// Flatten a category list into a display tree ordered parent-then-children.
/// `path` doubles as the legacy string snapshot (e.g. "Beverage/Cold").
export function flattenCategoryTree(cats: CategoryNode[]): FlatCategoryNode[] {
  const byParent = new Map<string | null, CategoryNode[]>();
  for (const c of cats) {
    const arr = byParent.get(c.parentId) ?? [];
    arr.push(c);
    byParent.set(c.parentId, arr);
  }
  for (const arr of byParent.values()) arr.sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name));

  const out: FlatCategoryNode[] = [];
  const walk = (parentId: string | null, depth: number, trail: string[]) => {
    for (const c of byParent.get(parentId) ?? []) {
      const path = trail.length ? `${trail[trail.length - 1]}/${c.name}` : c.name;
      out.push({ ...c, depth, path });
      walk(c.id, depth + 1, [...trail, c.name]);
    }
  };
  walk(null, 0, []);
  return out;
}

/// Selection options (indented by depth) for <select> dropdowns.
export function categoryOptions(cats: CategoryNode[]): { value: string; label: string }[] {
  return flattenCategoryTree(cats).map((c) => ({ value: c.id, label: `${"　".repeat(c.depth)}${c.path}` }));
}

/// "Parent / Child" segment list used for the POS till + filter chips.
export function categorySegments(path: string): string[] {
  return path
    .split("/")
    .map((s) => s.trim())
    .filter(Boolean);
}