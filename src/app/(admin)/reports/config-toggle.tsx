"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useT } from "@/components/i18n-provider";
import { ReportsConfig, type ReportConfigEntry, type ReportUserOption } from "@/app/(admin)/settings/reports-config";
import type { ReportSettings } from "@/lib/reports/config";

/// Admin-only entry point on the Reports console: the same optional
/// "develop · assign · design" configuration lives in Settings → Reports
/// (§M28). It is collapsed by default so operators keep a clean console.
export function ReportsConfigToggle({
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
  const { tUi } = useT();
  const [open, setOpen] = useState(false);

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">{tUi("Optional per-report configuration — which reports are switched on, who may open them and how they are styled (also in Settings → Reports).")}</p>
        <Button size="sm" variant="outline" onClick={() => setOpen((v) => !v)}>
          {tUi(open ? "Hide report configuration" : "Report configuration")}
        </Button>
      </div>
      {open ? <ReportsConfig reports={reports} users={users} value={value} canWrite={canWrite} /> : null}
    </div>
  );
}