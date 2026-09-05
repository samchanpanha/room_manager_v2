"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { Badge } from "@/components/ui/badge";
import { useT } from "@/components/i18n-provider";

export interface ReportMeta {
  key: string;
  /// Design override already applied by the page (falls back to the registry title).
  title: string;
  category: "ops" | "finance";
  source: string;
  dateFiltered: boolean;
  /// True when Settings → Reports → design overrides this report.
  designed?: boolean;
}

/// M26 report picker + filters — pushes ?key=&from=&to=&month=&propertyId=.
export function ReportPicker({
  reports,
  properties,
  current
}: {
  reports: ReportMeta[];
  properties: Array<{ id: string; name: string }>;
  current: { key: string; from?: string; to?: string; month?: string; propertyId?: string };
}) {
  const router = useRouter();
  const params = useSearchParams();
  const { tUi } = useT();
  const meta = reports.find((r) => r.key === current.key);
  const [key, setKey] = useState(current.key);
  const [from, setFrom] = useState(current.from ?? "");
  const [to, setTo] = useState(current.to ?? "");
  const [month, setMonth] = useState(current.month ?? "");
  const [propertyId, setPropertyId] = useState(current.propertyId ?? "");

  function apply() {
    const q = new URLSearchParams();
    q.set("key", key);
    if (meta?.dateFiltered) {
      if (key === "pnl" || key === "expense-vs-budget") {
        if (month) q.set("month", month);
      } else {
        if (from) q.set("from", from);
        if (to) q.set("to", to);
      }
    }
    if (propertyId) q.set("propertyId", propertyId);
    router.push(`/reports?${q.toString()}`);
  }

  return (
    <div className="mb-4 space-y-3 rounded-md border p-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="space-y-1.5">
          <Label htmlFor="rp-key">Report</Label>
          <SearchableSelect
            id="rp-key"
            aria-label="Report"
            value={key}
            onChange={setKey}
            options={reports.map((r) => ({ value: r.key, label: `${tUi(r.category === "ops" ? "OPS" : "FIN")} · ${tUi(r.title)}` }))}
            placeholder="Search reports…"
            emptyText="No matching report"
          />
        </div>
        {meta?.dateFiltered ? (
          key === "pnl" || key === "expense-vs-budget" ? (
            <div className="space-y-1.5">
              <Label htmlFor="rp-month">Month</Label>
              <Input id="rp-month" type="month" value={month} onChange={(e) => setMonth(e.target.value)} />
            </div>
          ) : (
            <>
              <div className="space-y-1.5">
                <Label htmlFor="rp-from">From</Label>
                <Input id="rp-from" type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="rp-to">To</Label>
                <Input id="rp-to" type="date" value={to} onChange={(e) => setTo(e.target.value)} />
              </div>
            </>
          )
        ) : null}
        <div className="space-y-1.5">
          <Label htmlFor="rp-prop">Property</Label>
          <SearchableSelect
            id="rp-prop"
            aria-label="Property"
            value={propertyId}
            onChange={setPropertyId}
            options={[{ value: "", label: "All in your scope" }, ...properties.map((p) => ({ value: p.id, label: p.name }))]}
            placeholder="Search property…"
            emptyText="No matching property"
          />
        </div>
      </div>
      <div className="flex items-center gap-2">
        <Button size="sm" onClick={apply}>
          Run report
        </Button>
        {meta?.designed ? <Badge variant="success">{tUi("designed")}</Badge> : null}
        {meta ? (
          <div className="flex gap-2 text-xs">
            <a className="underline underline-offset-4" href={`/api/reports/${current.key}/export?format=csv&${params.toString().split("&").filter((p) => p && !p.startsWith("key=")).join("&")}`}>
              CSV
            </a>
            <a className="underline underline-offset-4" href={`/api/reports/${current.key}/export?format=pdf&${params.toString().split("&").filter((p) => p && !p.startsWith("key=")).join("&")}`}>
              PDF
            </a>
          </div>
        ) : null}
      </div>
      {meta ? <p className="text-xs text-muted-foreground">{tUi("Source")}: {tUi(meta.source)}</p> : null}
    </div>
  );
}
