"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Input, Label, Select, Textarea } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/toast";
import { Tx } from "@/components/i18n-text";

interface FindingRow {
  id: string;
  itemLabel: string;
  severity: string;
  note: string;
  ticketCode: string | null;
  deductionMinor: number | null;
  deductionStatus: string | null;
  photoDocId: string | null;
}

interface Props {
  mode: "create" | "row";
  leases?: { id: string; label: string }[];
  inspection?: { id: string; code: string; status: string; type: string; leaseCode: string; roomNumber: string };
  findings?: FindingRow[];
  canUpdate?: boolean;
  canApproveDeduction?: boolean;
}

interface ItemRow {
  section: string;
  item: string;
  result: "pass" | "fail" | "na";
  severity?: string;
  note?: string;
}

export function InspectionActions({ mode, leases = [], inspection, findings = [], canUpdate, canApproveDeduction }: Props) {
  const router = useRouter();
  const { push } = useToast();
  const [busy, setBusy] = useState(false);

  async function post(url: string, body: unknown, okTitle: string, onDone?: () => void) {
    setBusy(true);
    const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const data = (await res.json().catch(() => ({}))) as { message?: string; code?: string; overallScore?: number; findings?: number };
    setBusy(false);
    if (!res.ok) {
      push({ title: "Failed", description: data.message ?? data.code, variant: "destructive" });
      return;
    }
    push({
      title: okTitle,
      description: data.overallScore != null ? `score ${data.overallScore}/100 · ${data.findings} finding(s)` : undefined,
      variant: "success"
    });
    onDone?.();
    router.refresh();
  }

  if (mode === "row") {
    const insp = inspection!;
    const canComplete = canUpdate && insp.status === "draft";
    const actionFindings = findings.filter((f) => canUpdate && !f.ticketCode);
    const deductionFindings = findings.filter((f) => canUpdate && f.deductionStatus === "proposed" && !f.ticketCode);
    return (
      <div className="flex justify-end gap-1.5">
        {canComplete ? <CompleteDialog busy={busy} onDone={(items, note) => post(`/api/inspections/${insp.id}/complete`, { items, summaryNote: note }, "Inspection completed", () => undefined)} /> : null}
        {actionFindings.length > 0 ? (
          <Button
            size="sm"
            variant="secondary"
            disabled={busy}
            onClick={() => void post(`/api/findings/${actionFindings[0]!.id}/ticket`, {}, "Ticket opened")}
          >
            Finding → ticket
          </Button>
        ) : null}
        {deductionFindings.length > 0 && canApproveDeduction ? (
          <Button
            size="sm"
            variant="secondary"
            disabled={busy}
            onClick={() => void post(`/api/findings/${deductionFindings[0]!.id}/deduction`, { op: "approve", reason: "damage" }, "Deduction approved in M10")}
          >
            Approve deduction
          </Button>
        ) : null}
        {deductionFindings.length > 0 && !canApproveDeduction ? <Badge variant="warning">deduction proposed — awaiting M10</Badge> : null}
      </div>
    );
  }

  return <CreateDialog busy={busy} leases={leases} onDone={(payload) => post("/api/inspections", payload, "Inspection opened")} />;
}

function CreateDialog({ busy, leases, onDone }: { busy: boolean; leases: { id: string; label: string }[]; onDone: (payload: Record<string, unknown>) => Promise<void> }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button size="sm" onClick={() => setOpen(true)}>
        New inspection…
      </Button>
      <Dialog open={open} onClose={() => setOpen(false)} title="Open inspection" description="Pick the type and lease — the room's checklist template attaches automatically.">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const fd = new FormData(e.currentTarget);
            const type = String(fd.get("type"));
            const scheduled = String(fd.get("scheduledAt") ?? "");
            void onDone({
              type,
              leaseId: String(fd.get("leaseId")),
              note: String(fd.get("note") ?? "") || undefined,
              scheduledAt: scheduled ? new Date(scheduled).toISOString() : undefined
            }).then((r) => {
              void r;
              setOpen(false);
            });
          }}
          className="space-y-4"
        >
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="insp-type">Type</Label>
              <Select id="insp-type" name="type" defaultValue="move_in" required>
                <option value="move_in"><Tx>Move-in</Tx></option>
                <option value="move_out"><Tx>Move-out</Tx></option>
                <option value="periodic"><Tx>Periodic</Tx></option>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="insp-lease">Lease</Label>
              <Select id="insp-lease" name="leaseId" defaultValue={leases[0]?.id} required>
                {leases.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.label}
                  </option>
                ))}
              </Select>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="insp-date">Scheduled for</Label>
            <Input id="insp-date" name="scheduledAt" type="date" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="insp-note">Note</Label>
            <Textarea id="insp-note" name="note" rows={2} maxLength={300} placeholder="optional" />
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={busy}>
              Open inspection
            </Button>
          </div>
        </form>
      </Dialog>
    </>
  );
}

function CompleteDialog({ busy, onDone }: { busy: boolean; onDone: (items: ItemRow[], note: string) => Promise<void> }) {
  const [open, setOpen] = useState(false);
  const [rows, setRows] = useState<ItemRow[]>([]);
  const [note, setNote] = useState("");

  function update(ix: number, patch: Partial<ItemRow>) {
    setRows((r) => r.map((row, i) => (i === ix ? { ...row, ...patch } : row)));
  }

  return (
    <>
      <Button size="sm" onClick={() => setOpen(true)}>
        Complete…
      </Button>
      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title="Complete inspection"
        description="Capture each item (pass / fail / NA). Failed items become findings — mark severity and add a note."
        wide
      >
        <div className="space-y-4">
          <div className="space-y-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setRows((r) => [...r, { section: "General", item: "", result: "pass" }])}
            >
              + Add checklist item
            </Button>
            {rows.length === 0 ? <p className="text-xs text-muted-foreground"><Tx>Add the checklist items you are capturing (mobile-friendly one-per-row).</Tx></p> : null}
            {rows.map((row, ix) => (
              <div key={ix} className="grid gap-2 rounded-md border p-2 sm:grid-cols-12">
                <Input
                  className="sm:col-span-4"
                  placeholder="Section"
                  value={row.section}
                  onChange={(e) => update(ix, { section: e.target.value })}
                />
                <Input
                  className="sm:col-span-4"
                  placeholder="Item (e.g. Door locks)"
                  value={row.item}
                  onChange={(e) => update(ix, { item: e.target.value })}
                  required
                />
                <Select className="sm:col-span-2" value={row.result} onChange={(e) => update(ix, { result: e.target.value as ItemRow["result"] })}>
                  <option value="pass"><Tx>pass</Tx></option>
                  <option value="fail"><Tx>fail</Tx></option>
                  <option value="na"><Tx>n/a</Tx></option>
                </Select>
                {row.result === "fail" ? (
                  <Select className="sm:col-span-2" value={row.severity ?? "minor"} onChange={(e) => update(ix, { severity: e.target.value })}>
                    <option value="minor"><Tx>minor</Tx></option>
                    <option value="major"><Tx>major</Tx></option>
                    <option value="critical"><Tx>critical</Tx></option>
                  </Select>
                ) : (
                  <div className="sm:col-span-2" />
                )}
                {row.result === "fail" ? (
                  <Textarea
                    className="sm:col-span-12"
                    rows={2}
                    maxLength={500}
                    placeholder="Finding note (what exactly is damaged)"
                    value={row.note ?? ""}
                    onChange={(e) => update(ix, { note: e.target.value })}
                  />
                ) : null}
                <div className="sm:col-span-12 text-right">
                  <Button type="button" variant="ghost" size="sm" onClick={() => setRows((r) => r.filter((_, i) => i !== ix))}>
                    Remove
                  </Button>
                </div>
              </div>
            ))}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="insp-summary">Summary note</Label>
            <Textarea id="insp-summary" rows={2} maxLength={500} value={note} onChange={(e) => setNote(e.target.value)} placeholder="optional" />
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Keep as draft
            </Button>
            <Button
              disabled={busy || rows.length === 0 || rows.some((r) => !r.item.trim())}
              onClick={() =>
                void onDone(
                  rows.map((r) => ({ ...r, section: r.section.trim() || "General", item: r.item.trim(), note: r.note?.trim() || undefined, severity: r.result === "fail" ? (r.severity ?? "minor") : undefined })),
                  note
                ).then(() => setOpen(false))
              }
            >
              Complete inspection
            </Button>
          </div>
        </div>
      </Dialog>
    </>
  );
}
