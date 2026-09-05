"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/input";
import { useToast } from "@/components/toast";
import { cn } from "@/lib/utils";
import { Tx } from "@/components/i18n-text";

interface GridRow {
  module: string;
  actions: string[];
  scope: string;
}

interface PermissionRowState {
  actions: Set<string>;
  scope: string;
}

export function PermissionGrid({
  roleId,
  modules,
  actions,
  initial,
  disabled
}: {
  roleId: string;
  modules: Array<{ key: string; name: string }>;
  actions: string[];
  initial: GridRow[];
  disabled: boolean;
}) {
  const router = useRouter();
  const { push } = useToast();
  const [busy, setBusy] = useState(false);
  const [grid, setGrid] = useState<Record<string, PermissionRowState>>(() => {
    const out: Record<string, PermissionRowState> = {};
    for (const m of modules) {
      const row = initial.find((r) => r.module === m.key);
      out[m.key] = { actions: new Set(row?.actions ?? []), scope: row?.scope ?? "GLOBAL" };
    }
    return out;
  });

  const toggleAction = (moduleKey: string, action: string) => {
    setGrid((prev) => {
      const row = prev[moduleKey];
      const next = new Set(row.actions);
      if (next.has(action)) next.delete(action);
      else next.add(action);
      return { ...prev, [moduleKey]: { ...row, actions: next } };
    });
  };

  const setScope = (moduleKey: string, scope: string) => {
    setGrid((prev) => ({ ...prev, [moduleKey]: { ...prev[moduleKey], scope } }));
  };

  async function save() {
    setBusy(true);
    const perms = Object.entries(grid)
      .filter(([, row]) => row.actions.size > 0)
      .map(([module, row]) => ({ module, actions: [...row.actions], scope: row.scope }));
    const res = await fetch(`/api/roles/${roleId}/permissions`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ perms })
    });
    const body = (await res.json().catch(() => ({}))) as { message?: string; saved?: number };
    setBusy(false);
    if (!res.ok) {
      push({ title: "Save failed", description: body.message, variant: "destructive" });
      return;
    }
    push({ title: `Saved ${body.saved} grants`, description: "Effective immediately for all users holding this role.", variant: "success" });
    router.refresh();
  }

  const total = Object.values(grid).reduce((n, r) => n + r.actions.size, 0);

  return (
    <div>
      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full min-w-[760px] text-sm">
          <thead>
            <tr className="border-b bg-muted/40">
              <th className="px-3 py-2 text-left font-medium text-muted-foreground"><Tx>Module</Tx></th>
              {actions.map((a) => (
                <th key={a} className="px-2 py-2 text-center font-medium capitalize text-muted-foreground">
                  {a}
                </th>
              ))}
              <th className="px-2 py-2 text-center font-medium text-muted-foreground"><Tx>Scope</Tx></th>
            </tr>
          </thead>
          <tbody>
            {modules.map((m, i) => (
              <tr key={m.key} className={cn(i % 2 === 1 && "bg-muted/20")}>
                <td className="px-3 py-1.5">
                  <span className="font-mono text-xs text-muted-foreground">{m.key}</span> {m.name}
                </td>
                {actions.map((a) => (
                  <td key={a} className="px-2 py-1.5 text-center">
                    <input
                      type="checkbox"
                      className="h-4 w-4"
                      checked={grid[m.key].actions.has(a)}
                      onChange={() => toggleAction(m.key, a)}
                      disabled={disabled}
                      aria-label={`${m.key} ${a}`}
                    />
                  </td>
                ))}
                <td className="px-2 py-1.5">
                  <Select
                    className="h-7 w-28 text-xs"
                    value={grid[m.key].scope}
                    onChange={(e) => setScope(m.key, e.target.value)}
                    disabled={disabled || grid[m.key].actions.size === 0}
                  >
                    <option value="GLOBAL">GLOBAL</option>
                    <option value="PROPERTY">PROPERTY</option>
                    <option value="OWN">OWN</option>
                  </Select>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="mt-4 flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{total} grants selected</p>
        <Button onClick={save} disabled={disabled || busy}>
          {busy ? "Saving…" : "Save permission grid"}
        </Button>
      </div>
    </div>
  );
}
