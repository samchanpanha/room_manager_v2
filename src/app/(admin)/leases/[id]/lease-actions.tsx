"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Label, Textarea } from "@/components/ui/input";
import { useToast } from "@/components/toast";

export function LeaseActions({
  lease,
  canUpdate,
  contractFiled
}: {
  lease: { id: string; code: string; status: string };
  canUpdate: boolean;
  contractFiled: boolean;
}) {
  const router = useRouter();
  const { push } = useToast();
  const [busy, setBusy] = useState(false);
  const [terminateOpen, setTerminateOpen] = useState(false);

  async function act(action: string, body?: unknown, confirmText?: string) {
    if (confirmText && !window.confirm(confirmText)) return;
    setBusy(true);
    const res = await fetch(`/api/leases/${lease.id}/${action}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: body ? JSON.stringify(body) : undefined
    });
    const data = (await res.json().catch(() => ({}))) as { message?: string; notes?: string[] };
    setBusy(false);
    if (!res.ok) {
      push({ title: `${action} failed`, description: data.message, variant: "destructive" });
      return;
    }
    push({
      title: `Lease ${lease.code} ${action === "activate" ? "activated" : action === "notice" ? "→ notice" : action === "complete" ? "completed" : "terminated"}`,
      description: data.notes?.slice(0, 2).join(" · "),
      variant: "success"
    });
    router.refresh();
  }

  async function downloadContract() {
    setBusy(true);
    const res = await fetch(`/api/leases/${lease.id}/contract`);
    setBusy(false);
    if (!res.ok) {
      const data = (await res.json().catch(() => ({}))) as { message?: string };
      push({ title: "PDF failed", description: data.message, variant: "destructive" });
      return;
    }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    window.open(url, "_blank");
    setTimeout(() => URL.revokeObjectURL(url), 30_000);
    router.refresh();
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button variant="outline" size="sm" disabled={busy} onClick={downloadContract}>
        Contract PDF{contractFiled ? " ✓filed" : ""}
      </Button>

      {canUpdate && lease.status === "draft" ? (
        <>
          <Button variant="success" size="sm" disabled={busy} onClick={() => act("activate", undefined, `Activate ${lease.code}? Room becomes occupied, member becomes active, first invoice is scheduled.`)}>
            Activate lease
          </Button>
          <Button variant="destructive" size="sm" disabled={busy} onClick={() => deleteDraft()}>
            Delete draft
          </Button>
        </>
      ) : null}

      {canUpdate && lease.status === "active" ? (
        <Button variant="outline" size="sm" disabled={busy} onClick={() => act("notice", undefined, `Give notice on ${lease.code}?`)}>
          Give notice
        </Button>
      ) : null}

      {canUpdate && (lease.status === "active" || lease.status === "notice") ? (
        <>
          <Button variant="secondary" size="sm" disabled={busy} onClick={() => act("complete", undefined, `Complete ${lease.code}? Room goes to cleaning, deposit settlement is triggered.`)}>
            Complete
          </Button>
          <Button variant="destructive" size="sm" disabled={busy} onClick={() => setTerminateOpen(true)}>
            Terminate…
          </Button>
        </>
      ) : null}

      <Dialog open={terminateOpen} onClose={() => setTerminateOpen(false)} title="Terminate lease" description="A written reason is mandatory. Clearance and inspection gates tighten as those modules land.">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const reason = String(new FormData(e.currentTarget).get("reason") ?? "");
            void act("terminate", { reason }).then(() => setTerminateOpen(false));
          }}
          className="space-y-4"
        >
          <div className="space-y-1.5">
            <Label htmlFor="t-reason">Reason</Label>
            <Textarea id="t-reason" name="reason" rows={3} required minLength={3} maxLength={500} />
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setTerminateOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="destructive" disabled={busy}>
              {busy ? "Working…" : "Terminate lease"}
            </Button>
          </div>
        </form>
      </Dialog>
    </div>
  );

  async function deleteDraft() {
    if (!window.confirm(`Delete draft ${lease.code}? This cannot be undone (drafts are not posted records).`)) return;
    setBusy(true);
    const res = await fetch(`/api/leases/${lease.id}`, { method: "DELETE" });
    const data = (await res.json().catch(() => ({}))) as { message?: string };
    setBusy(false);
    if (!res.ok) {
      push({ title: "Delete failed", description: data.message, variant: "destructive" });
      return;
    }
    push({ title: "Draft deleted", variant: "success" });
    router.push("/leases");
  }
}
