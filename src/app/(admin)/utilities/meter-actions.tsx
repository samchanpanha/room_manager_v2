"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Input, Label, Textarea } from "@/components/ui/input";
import { useToast } from "@/components/toast";

import { Tx } from "@/components/i18n-text";
interface MeterRef {
  id: string;
  code: string;
  unitLabel: string;
  hasReadings: boolean;
}

export function MeterActions({ meter, canRecord }: { meter: MeterRef; canRecord: boolean }) {
  const router = useRouter();
  const { push } = useToast();
  const [busy, setBusy] = useState(false);
  const [readingOpen, setReadingOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);

  async function post(url: string, body: unknown, okTitle: string) {
    setBusy(true);
    const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const data = (await res.json().catch(() => ({}))) as { message?: string; warnings?: string[] };
    setBusy(false);
    if (!res.ok) {
      push({ title: "Failed", description: data.message, variant: "destructive" });
      return false;
    }
    push({ title: okTitle, description: data.warnings?.join(" · "), variant: data.warnings?.length ? "default" : "success" });
    router.refresh();
    return true;
  }

  if (!canRecord) return <span className="text-xs text-muted-foreground">—</span>;

  return (
    <div className="flex justify-end gap-1.5">
      <Button size="sm" variant="secondary" disabled={busy} onClick={() => setReadingOpen(true)}>
        Read
      </Button>
      <Button size="sm" variant="outline" disabled={busy} onClick={() => setImportOpen(true)}>
        Import CSV
      </Button>

      <Dialog
        open={readingOpen}
        onClose={() => setReadingOpen(false)}
        title={`Record reading — ${meter.code}`}
        description={`Current value in ${meter.unitLabel} (decimals allowed). Tick "estimate" to use the average of the last 3 readings (flagged, §M11).`}
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const fd = new FormData(e.currentTarget);
            const estimate = fd.get("estimate") === "on";
            const value = String(fd.get("value") ?? "").trim();
            void post(
              `/api/meters/${meter.id}/readings`,
              {
                estimate,
                value: estimate || value === "" ? undefined : Number(value),
                note: String(fd.get("note") ?? "") || undefined
              },
              "Reading recorded"
            ).then((done) => {
              if (done) setReadingOpen(false);
            });
          }}
          className="space-y-4"
        >
          <div className="space-y-1.5">
            <Label htmlFor={`mv-${meter.id}`}>Value ({meter.unitLabel})</Label>
            <Input id={`mv-${meter.id}`} name="value" type="number" step="0.001" min="0" disabled={false} />
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="estimate" className="h-4 w-4" />
            <Tx>Estimated reading (average of last 3)
          </Tx></label>
          <div className="space-y-1.5">
            <Label htmlFor={`mn-${meter.id}`}>Note</Label>
            <Input id={`mn-${meter.id}`} name="note" maxLength={300} placeholder="optional" />
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setReadingOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={busy}>
              Save reading
            </Button>
          </div>
        </form>
      </Dialog>

      <Dialog
        open={importOpen}
        onClose={() => setImportOpen(false)}
        title={`Import readings — ${meter.code}`}
        description="One reading per line: YYYY-MM-DD,value[,note] — values in display units. Rows are skipped (with reasons) when invalid or out of order."
        wide
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const fd = new FormData(e.currentTarget);
            void post(`/api/meters/${meter.id}/readings/import`, { csv: String(fd.get("csv") ?? "") }, "CSV processed").then((done) => {
              if (done) setImportOpen(false);
            });
          }}
          className="space-y-4"
        >
          <Textarea name="csv" rows={6} placeholder={`2026-09-01,1204.6\n2026-09-02,1211.0,weekly check`} required />
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setImportOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={busy}>
              Import
            </Button>
          </div>
        </form>
      </Dialog>
    </div>
  );
}
