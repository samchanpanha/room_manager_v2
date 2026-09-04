"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Input, Label, Select, Textarea } from "@/components/ui/input";
import { useToast } from "@/components/toast";

interface Props {
  mode: "create" | "row";
  members?: { id: string; label: string }[];
  complaint?: { id: string; code: string; status: string; hasTicket: boolean };
  canAct?: boolean;
  canClose?: boolean;
  canCreateGlobal?: boolean;
  slaHint?: Record<string, number>;
}

const NEXT_OPS: Record<string, Array<{ op: "acknowledge" | "start" | "resolve" | "convert" | "comment"; label: string }>> = {
  new: [{ op: "acknowledge", label: "Acknowledge" }, { op: "comment", label: "Comment…" }],
  acknowledged: [{ op: "start", label: "Start work" }, { op: "resolve", label: "Resolve…" }, { op: "convert", label: "→ Ticket" }, { op: "comment", label: "Comment…" }],
  in_progress: [{ op: "resolve", label: "Resolve…" }, { op: "convert", label: "→ Ticket" }, { op: "comment", label: "Comment…" }],
  resolved: [{ op: "comment", label: "Comment…" }]
};

export function ComplaintActions({ mode, members = [], complaint, canAct, canClose, slaHint }: Props) {
  const router = useRouter();
  const { push } = useToast();
  const [busy, setBusy] = useState(false);

  async function post(url: string, body: unknown, okTitle: string, onDone?: () => void) {
    setBusy(true);
    const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const data = (await res.json().catch(() => ({}))) as { message?: string; code?: string; ticketCode?: string };
    setBusy(false);
    if (!res.ok) {
      push({ title: "Failed", description: data.message ?? data.code, variant: "destructive" });
      return;
    }
    push({ title: okTitle, description: data.ticketCode ? `ticket ${data.ticketCode}` : undefined, variant: "success" });
    onDone?.();
    router.refresh();
  }

  if (mode === "row") {
    const c = complaint!;
    const ops = canAct ? (NEXT_OPS[c.status] ?? []) : [];
    return (
      <div className="flex justify-end gap-1.5">
        {ops.find((o) => o.op === "acknowledge") ? (
          <Button size="sm" variant="secondary" disabled={busy} onClick={() => void post(`/api/complaints/${c.id}`, { op: "acknowledge" }, "Acknowledged")}>
            Acknowledge
          </Button>
        ) : null}
        {ops.find((o) => o.op === "start") ? (
          <Button size="sm" variant="secondary" disabled={busy} onClick={() => void post(`/api/complaints/${c.id}`, { op: "start" }, "Work started")}>
            Start
          </Button>
        ) : null}
        {ops.find((o) => o.op === "resolve") ? <ResolveDialog busy={busy} onDone={(note) => post(`/api/complaints/${c.id}`, { op: "resolve", resolutionNote: note }, "Resolved — awaiting member rating")} /> : null}
        {ops.find((o) => o.op === "convert") && !c.hasTicket ? (
          <Button size="sm" variant="outline" disabled={busy} onClick={() => void post(`/api/complaints/${c.id}`, { op: "convert", category: "other" }, "Converted to ticket")}>
            → Ticket
          </Button>
        ) : null}
        {ops.find((o) => o.op === "comment") ? <CommentDialog busy={busy} onDone={(body) => post(`/api/complaints/${c.id}`, { op: "comment", body }, "Comment added")} /> : null}
        {canClose ? <RatingDialog busy={busy} onDone={(rating, note) => post(`/api/complaints/${c.id}`, { op: "close", rating, ratingNote: note }, "Closed — thanks for the rating")} /> : null}
      </div>
    );
  }

  if (members.length === 0) return null;
  return <CreateDialog busy={busy} members={members} slaHint={slaHint} onDone={(payload) => post("/api/complaints", payload, "Complaint filed")} />;
}

function CreateDialog({
  busy,
  members,
  slaHint,
  onDone
}: {
  busy: boolean;
  members: { id: string; label: string }[];
  slaHint?: Record<string, number>;
  onDone: (payload: Record<string, unknown>) => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button size="sm" onClick={() => setOpen(true)}>
        File complaint…
      </Button>
      <Dialog open={open} onClose={() => setOpen(false)} title="File complaint" description={`SLA by priority: high ${slaHint?.high ?? 24}h · medium ${slaHint?.medium ?? 72}h · low ${slaHint?.low ?? 168}h. Filed members can comment and rate their own.`} wide>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const fd = new FormData(e.currentTarget);
            void onDone({
              memberProfileId: String(fd.get("memberProfileId")),
              category: String(fd.get("category")),
              priority: String(fd.get("priority")),
              subject: String(fd.get("subject")),
              description: String(fd.get("description"))
            }).then(() => setOpen(false));
          }}
          className="space-y-4"
        >
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="cmp-member">Member</Label>
              <Select id="cmp-member" name="memberProfileId" defaultValue={members[0]?.id} required>
                {members.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.label}
                  </option>
                ))}
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="cmp-cat">Category</Label>
              <Select id="cmp-cat" name="category" defaultValue="noise" required>
                {["noise", "cleanliness", "neighbor", "staff", "facility", "billing", "other"].map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="cmp-pri">Priority</Label>
              <Select id="cmp-pri" name="priority" defaultValue="medium" required>
                {["low", "medium", "high"].map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="cmp-subj">Subject</Label>
              <Input id="cmp-subj" name="subject" minLength={3} maxLength={120} required />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="cmp-desc">Description</Label>
            <Textarea id="cmp-desc" name="description" rows={3} maxLength={2000} required />
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={busy}>
              File complaint
            </Button>
          </div>
        </form>
      </Dialog>
    </>
  );
}

function ResolveDialog({ busy, onDone }: { busy: boolean; onDone: (note: string) => Promise<void> }) {
  const [open, setOpen] = useState(false);
  return (
    <Dialog open={open} onClose={() => setOpen(false)} title="Resolve complaint" description="The member then confirms and rates to close.">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          const fd = new FormData(e.currentTarget);
          void onDone(String(fd.get("resolutionNote"))).then(() => setOpen(false));
        }}
        className="space-y-4"
      >
        <div className="space-y-1.5">
          <Label htmlFor="cmp-res">Resolution note</Label>
          <Textarea id="cmp-res" name="resolutionNote" rows={3} maxLength={1000} required minLength={3} />
        </div>
        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={() => setOpen(false)}>
            Back
          </Button>
          <Button type="submit" disabled={busy}>
            Resolve
          </Button>
        </div>
      </form>
    </Dialog>
  );
}

function CommentDialog({ busy, onDone }: { busy: boolean; onDone: (body: string) => Promise<void> }) {
  const [open, setOpen] = useState(false);
  return (
    <Dialog open={open} onClose={() => setOpen(false)} title="Add comment" description="Visible to the member in their thread.">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          const fd = new FormData(e.currentTarget);
          void onDone(String(fd.get("body"))).then(() => setOpen(false));
        }}
        className="space-y-4"
      >
        <div className="space-y-1.5">
          <Label htmlFor="cmp-body">Comment</Label>
          <Textarea id="cmp-body" name="body" rows={3} maxLength={1000} required minLength={1} />
        </div>
        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button type="submit" disabled={busy}>
            Comment
          </Button>
        </div>
      </form>
    </Dialog>
  );
}

function RatingDialog({ busy, onDone }: { busy: boolean; onDone: (rating: number, note: string) => Promise<void> }) {
  const [open, setOpen] = useState(false);
  return (
    <Dialog open={open} onClose={() => setOpen(false)} title="Confirm resolution & rate" description="Your rating closes the complaint (required, 1–5).">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          const fd = new FormData(e.currentTarget);
          void onDone(Number(fd.get("rating")), String(fd.get("ratingNote") ?? "")).then(() => setOpen(false));
        }}
        className="space-y-4"
      >
        <div className="space-y-1.5">
          <Label htmlFor="cmp-rating">Rating</Label>
          <Select id="cmp-rating" name="rating" defaultValue="5" required>
            {[5, 4, 3, 2, 1].map((r) => (
              <option key={r} value={r}>
                {r} / 5
              </option>
            ))}
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="cmp-rating-note">Note (optional)</Label>
          <Textarea id="cmp-rating-note" name="ratingNote" rows={2} maxLength={300} />
        </div>
        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={() => setOpen(false)}>
            Later
          </Button>
          <Button type="submit" disabled={busy}>
            Confirm & close
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
