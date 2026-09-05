"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input, Label, Textarea } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { useToast } from "@/components/toast";
import { useT } from "@/components/i18n-provider";
import { cn } from "@/lib/utils";
import type { ReportDesignColumn, ReportSettings } from "@/lib/reports/config";

export interface ReportConfigEntry {
  key: string;
  title: string;
  category: "ops" | "finance";
  columns: Array<{ key: string; label: string }>;
}

export interface ReportUserOption {
  id: string;
  name: string;
  email: string;
}

type Tab = "develop" | "assign" | "design";

/// §M28 Settings → Reports — the OPTIONAL configuration for M26:
///
///   develop · which registered reports are switched on for the org
///             (nothing ticked = every report the caller's role permits)
///   assign  · which users may open a report (empty = unrestricted)
///   design  · presentation only: title, description and an ordered subset of
///             the registry columns with optional label overrides
///
/// Report data is never editable here — numbers keep coming from the registry
/// queries so every figure stays traceable (§M26). Changes are saved through
/// PATCH /api/settings, audited like any other M28 group, and applied by the
/// Reports console and the CSV/XLSX/PDF export routes.
export function ReportsConfig({
  reports,
  users,
  value,
  canWrite
}: {
  reports: ReportConfigEntry[];
  users: ReportUserOption[];
  value: ReportSettings;
  canWrite: boolean;
}) {
  const router = useRouter();
  const { push } = useToast();
  const { tUi } = useT();
  const [tab, setTab] = useState<Tab>("develop");
  const [draft, setDraft] = useState<ReportSettings>(value);
  const [designKey, setDesignKey] = useState(reports[0]?.key ?? "");
  const [busy, setBusy] = useState(false);

  const dirty = JSON.stringify(draft) !== JSON.stringify(value);
  const enabled = draft.enabledKeys.length === 0 ? new Set(reports.map((r) => r.key)) : new Set(draft.enabledKeys);
  const explicit = draft.enabledKeys.length > 0;

  const byCategory = useMemo(() => {
    const groups: Record<string, ReportConfigEntry[]> = { ops: [], finance: [] };
    for (const r of reports) (groups[r.category] ??= []).push(r);
    return groups;
  }, [reports]);

  function toggleEnabled(key: string, on: boolean) {
    // Editing materialises the implicit "all" into an explicit list so the
    // stored value always says exactly what the operator sees.
    const current = explicit ? draft.enabledKeys : reports.map((r) => r.key);
    const next = on ? [...current, key] : current.filter((k) => k !== key);
    const all = reports.every((r) => next.includes(r.key));
    setDraft({ ...draft, enabledKeys: all ? [] : next });
  }

  function resetEnabled() {
    setDraft({ ...draft, enabledKeys: [] });
  }

  function toggleUser(key: string, userId: string, on: boolean) {
    const list = draft.assignments[key] ?? [];
    const next = on ? [...list, userId] : list.filter((id) => id !== userId);
    const assignments = { ...draft.assignments };
    if (next.length === 0) delete assignments[key];
    else assignments[key] = next;
    setDraft({ ...draft, assignments });
  }

  function patchDesign(key: string, patch: Partial<ReportSettings["designs"][string]>) {
    const designs = { ...draft.designs };
    const next = { ...(designs[key] ?? {}), ...patch };
    if (!next.title && !next.description && !next.columns?.length) delete designs[key];
    else designs[key] = next;
    setDraft({ ...draft, designs });
  }

  function toggleColumn(key: string, columnKey: string, on: boolean) {
    const report = reports.find((r) => r.key === key);
    if (!report) return;
    // No stored design yet ⇒ start from the full registry order.
    const current: ReportDesignColumn[] = draft.designs[key]?.columns?.length
      ? draft.designs[key]!.columns!
      : report.columns.map((c) => ({ key: c.key }));
    const next = on ? [...current, { key: columnKey }] : current.filter((c) => c.key !== columnKey);
    const isDefault =
      next.length === report.columns.length && next.every((c, i) => c.key === report.columns[i]!.key && !c.label);
    patchDesign(key, { columns: isDefault ? undefined : next });
  }

  function moveColumn(key: string, columnKey: string, dir: -1 | 1) {
    const current = draft.designs[key]?.columns;
    if (!current) return;
    const i = current.findIndex((c) => c.key === columnKey);
    const j = i + dir;
    if (i < 0 || j < 0 || j >= current.length) return;
    const next = [...current];
    const [item] = next.splice(i, 1);
    next.splice(j, 0, item!);
    patchDesign(key, { columns: next });
  }

  function setColumnLabel(key: string, columnKey: string, label: string) {
    const current = draft.designs[key]?.columns;
    if (!current) return;
    patchDesign(key, { columns: current.map((c) => (c.key === columnKey ? (label.trim() ? { ...c, label: label.trim() } : { key: c.key }) : c)) });
  }

  async function save() {
    setBusy(true);
    const res = await fetch("/api/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ group: "reports", patch: draft })
    });
    const data = (await res.json().catch(() => ({}))) as { message?: string; settings?: { reports?: ReportSettings } };
    setBusy(false);
    push(
      res.ok
        ? { title: tUi("Reports configuration saved"), variant: "success" }
        : { title: tUi("Save failed"), description: data.message, variant: "destructive" }
    );
    if (res.ok) {
      if (data.settings?.reports) setDraft(data.settings.reports);
      router.refresh();
    }
  }

  const design = draft.designs[designKey];
  const designReport = reports.find((r) => r.key === designKey);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Reports configuration</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-xs text-muted-foreground">{tUi("Optional per-report configuration: switch reports on (develop), limit them to named users (assign) and restyle their title, description and columns (design). Report numbers always come from the registry queries — nothing here edits data.")}</p>

        <div className="flex flex-wrap items-center gap-2">
          {(["develop", "assign", "design"] as Tab[]).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTab(t)}
              className={cn(
                "rounded-md border px-3 py-1.5 text-xs font-medium transition-colors",
                tab === t ? "border-primary bg-primary/10 text-primary" : "hover:bg-accent"
              )}
            >
              {tUi(t === "develop" ? "Develop" : t === "assign" ? "Assign" : "Design")}
            </button>
          ))}
          <span className="ml-auto text-[11px] text-muted-foreground">
            {dirty ? tUi("Unsaved changes") : tUi("Saved")}
          </span>
        </div>

        {tab === "develop" ? (
          <div className="space-y-4">
            <p className="text-xs text-muted-foreground">{tUi("Tick the reports this org uses. Untick everything (Reset) to fall back to all reports the caller's role permits.")}</p>
            {(["ops", "finance"] as const).map((category) => (
              <div key={category}>
                <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                  {tUi(category === "ops" ? "Operations reports" : "Finance reports")}
                </p>
                <div className="grid gap-1.5 sm:grid-cols-2">
                  {(byCategory[category] ?? []).map((r) => (
                    <label
                      key={r.key}
                      className={cn(
                        "flex items-center gap-2 rounded-md border px-2.5 py-1.5 text-sm",
                        enabled.has(r.key) ? "border-primary/40 bg-primary/5" : "opacity-70",
                        !canWrite && "cursor-not-allowed"
                      )}
                    >
                      <input
                        type="checkbox"
                        checked={enabled.has(r.key)}
                        disabled={!canWrite}
                        onChange={(e) => toggleEnabled(r.key, e.target.checked)}
                      />
                      <span className="min-w-0 flex-1 truncate">{tUi(r.title)}</span>
                      <code className="shrink-0 text-[10px] text-muted-foreground">{r.key}</code>
                    </label>
                  ))}
                </div>
              </div>
            ))}
            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant="outline" disabled={!canWrite || !explicit} onClick={resetEnabled}>
                Reset to all reports
              </Button>
              <span className="self-center text-[11px] text-muted-foreground">
                {explicit ? tUi("{n} report(s) enabled").replace("{n}", String(draft.enabledKeys.length)) : tUi("Every report the caller's role permits")}
              </span>
            </div>
          </div>
        ) : null}

        {tab === "assign" ? (
          <div className="space-y-3">
            <p className="text-xs text-muted-foreground">{tUi("Assignment is optional. A user who appears in any report assignment sees exactly those reports; users who appear in none see every enabled report their role permits.")}</p>
            {reports.map((r) => {
              const assignedIds = draft.assignments[r.key] ?? [];
              return (
                <div key={r.key} className="rounded-md border p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-sm font-medium">
                      {tUi(r.title)} <code className="ml-1 text-[10px] text-muted-foreground">{r.key}</code>
                    </p>
                    {assignedIds.length === 0 ? (
                      <Badge variant="secondary">{tUi("Everyone permitted")}</Badge>
                    ) : (
                      <Badge variant="info">{tUi("{n} user(s) assigned").replace("{n}", String(assignedIds.length))}</Badge>
                    )}
                  </div>
                  <div className="mt-2 flex flex-wrap items-center gap-1.5">
                    {assignedIds.map((id) => {
                      const u = users.find((x) => x.id === id);
                      return (
                        <span key={id} className="inline-flex items-center gap-1 rounded-md border bg-muted/50 px-2 py-0.5 text-xs">
                          {u ? `${u.name} · ${u.email}` : id}
                          {canWrite ? (
                            <button type="button" aria-label={tUi("Remove")} onClick={() => toggleUser(r.key, id, false)} className="text-muted-foreground hover:text-destructive">
                              ×
                            </button>
                          ) : null}
                        </span>
                      );
                    })}
                    {canWrite ? (
                      <div className="w-56">
                        <SearchableSelect
                          value=""
                          onChange={(id) => id && toggleUser(r.key, id, true)}
                          options={users.filter((u) => !assignedIds.includes(u.id)).map((u) => ({ value: u.id, label: `${u.name} · ${u.email}` }))}
                          placeholder={tUi("Add user…")}
                          aria-label={tUi("Assigned users")}
                        />
                      </div>
                    ) : null}
                  </div>
                </div>
              );
            })}
          </div>
        ) : null}

        {tab === "design" ? (
          <div className="space-y-3">
            <p className="text-xs text-muted-foreground">{tUi("Design overrides presentation only — the title, an optional description and which columns appear (in this order, with optional labels). Exports follow the same design.")}</p>
            <div className="grid gap-3 md:grid-cols-[minmax(0,16rem)_minmax(0,1fr)]">
              <div className="space-y-1">
                <Label htmlFor="design-report">{tUi("Report")}</Label>
                <SearchableSelect
                  id="design-report"
                  value={designKey}
                  onChange={setDesignKey}
                  options={reports.map((r) => ({ value: r.key, label: `${r.category === "ops" ? tUi("OPS") : tUi("FIN")} · ${tUi(r.title)}` }))}
                  placeholder={tUi("Search reports…")}
                  aria-label={tUi("Report")}
                />
                <div className="mt-2 space-y-1 rounded-md border p-2">
                  {reports.map((r) => (
                    <button
                      key={r.key}
                      type="button"
                      onClick={() => setDesignKey(r.key)}
                      className={cn(
                        "flex w-full items-center justify-between gap-2 rounded px-2 py-1 text-left text-xs hover:bg-accent",
                        designKey === r.key && "bg-accent font-medium"
                      )}
                    >
                      <span className="min-w-0 truncate">{tUi(r.title)}</span>
                      {draft.designs[r.key] ? <Badge variant="success">{tUi("designed")}</Badge> : null}
                    </button>
                  ))}
                </div>
              </div>

              {designReport ? (
                <div className="space-y-3 rounded-md border p-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="design-title">{tUi("Custom title")}</Label>
                    <Input
                      id="design-title"
                      value={design?.title ?? ""}
                      disabled={!canWrite}
                      placeholder={tUi(designReport.title)}
                      onChange={(e) => patchDesign(designReport.key, { title: e.target.value })}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="design-desc">{tUi("Custom description")}</Label>
                    <Textarea
                      id="design-desc"
                      value={design?.description ?? ""}
                      disabled={!canWrite}
                      placeholder={tUi("Shown under the report title (optional)")}
                      onChange={(e) => patchDesign(designReport.key, { description: e.target.value })}
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label>{tUi("Columns")}</Label>
                    <p className="text-[11px] text-muted-foreground">{tUi("Untick a column to hide it; use ↑ ↓ to reorder; type a label to override the registry label.")}</p>
                    <ul className="space-y-1">
                      {((design?.columns?.length ? design.columns : designReport.columns.map((c) => ({ key: c.key } as ReportDesignColumn)))).map((c, i, list) => {
                        const registry = designReport.columns.find((rc) => rc.key === c.key);
                        if (!registry) return null;
                        return (
                          <li key={c.key} className="flex items-center gap-2 rounded-md border px-2 py-1.5">
                            <input
                              type="checkbox"
                              checked
                              disabled={!canWrite}
                              aria-label={tUi("Include column")}
                              onChange={(e) => toggleColumn(designReport.key, c.key, e.target.checked)}
                            />
                            <code className="w-32 shrink-0 truncate text-[11px] text-muted-foreground">{c.key}</code>
                            <Input
                              className="h-7 flex-1 text-xs"
                              value={c.label ?? ""}
                              disabled={!canWrite}
                              placeholder={tUi(registry.label)}
                              aria-label={tUi("Column label")}
                              onChange={(e) => setColumnLabel(designReport.key, c.key, e.target.value)}
                            />
                            <div className="flex shrink-0 gap-1">
                              <Button size="icon" variant="ghost" className="h-7 w-7" disabled={!canWrite || i === 0} aria-label={tUi("Move up")} onClick={() => moveColumn(designReport.key, c.key, -1)}>
                                ↑
                              </Button>
                              <Button size="icon" variant="ghost" className="h-7 w-7" disabled={!canWrite || i === list.length - 1} aria-label={tUi("Move down")} onClick={() => moveColumn(designReport.key, c.key, 1)}>
                                ↓
                              </Button>
                            </div>
                          </li>
                        );
                      })}
                      {designReport.columns
                        .filter((rc) => !(design?.columns ?? []).some((c) => c.key === rc.key))
                        .map((rc) => (
                          <li key={rc.key} className="flex items-center gap-2 rounded-md border border-dashed px-2 py-1.5 opacity-70">
                            <input
                              type="checkbox"
                              checked={false}
                              disabled={!canWrite}
                              aria-label={tUi("Include column")}
                              onChange={(e) => toggleColumn(designReport.key, rc.key, e.target.checked)}
                            />
                            <code className="w-32 shrink-0 truncate text-[11px] text-muted-foreground">{rc.key}</code>
                            <span className="flex-1 text-xs text-muted-foreground">{tUi(rc.label)}</span>
                          </li>
                        ))}
                    </ul>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={!canWrite || !draft.designs[designReport.key]}
                      onClick={() => {
                        const designs = { ...draft.designs };
                        delete designs[designReport.key];
                        setDraft({ ...draft, designs });
                      }}
                    >
                      Reset design
                    </Button>
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        ) : null}

        {canWrite ? (
          <div className="flex items-center gap-2 border-t pt-3">
            <Button size="sm" disabled={busy || !dirty} onClick={() => void save()}>
              Save reports configuration
            </Button>
            {dirty ? (
              <Button size="sm" variant="ghost" disabled={busy} onClick={() => setDraft(value)}>
                Discard changes
              </Button>
            ) : null}
          </div>
        ) : (
          <p className="border-t pt-3 text-xs text-muted-foreground">{tUi("Read-only — report configuration needs Admin (M28:update).")}</p>
        )}
      </CardContent>
    </Card>
  );
}
