"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input, Label, Select, Textarea } from "@/components/ui/input";
import { useToast } from "@/components/toast";
import { useT } from "@/components/i18n-provider";

export interface TicketRow { id: string; code: string; title: string; status: string; slaDueAt: string | null }
export interface ComplaintRow { id: string; code: string; subject: string; status: string }
export interface RoomOption { id: string; label: string }

const TABS = ["Maintenance", "Complaints", "Room move", "Move-out"] as const;
type Tab = (typeof TABS)[number];

async function post(url: string, body: unknown): Promise<{ ok: boolean; message?: string }> {
  const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const data = (await res.json().catch(() => ({}))) as { message?: string };
  return { ok: res.ok, message: data.message };
}

/// §M25 requests — maintenance ticket (M19), complaint (M22), room-move
/// request (M16, requestedByRole "member") and move-out notice (via
/// /api/portal/notices → the M05 give-notice logic). All own-scope.
/// Resident-facing copy follows the active locale: raw text goes through tUi,
/// labels/placeholders/options/buttons/badges/toasts through the primitives.
export function RequestsClient({
  memberId,
  leaseId,
  tickets,
  complaints,
  rooms,
  leaseStatus
}: {
  memberId: string;
  leaseId: string | null;
  tickets: TicketRow[];
  complaints: ComplaintRow[];
  rooms: RoomOption[];
  leaseStatus: string | null;
}) {
  const router = useRouter();
  const { push } = useToast();
  const { tUi } = useT();
  const [tab, setTab] = useState<Tab>("Maintenance");
  const [busy, setBusy] = useState(false);

  async function run(fn: () => Promise<{ ok: boolean; message?: string }>, okTitle: string) {
    setBusy(true);
    const r = await fn();
    setBusy(false);
    if (!r.ok) {
      push({ title: "Failed", description: r.message, variant: "destructive" });
      return false;
    }
    push({ title: okTitle, variant: "success" });
    router.refresh();
    return true;
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-4 gap-1 rounded-md border p-1 text-xs">
        {TABS.map((t) => (
          <button key={t} onClick={() => setTab(t)} className={`rounded px-1 py-1.5 ${tab === t ? "bg-foreground text-background" : "text-muted-foreground"}`}>
            {t}
          </button>
        ))}
      </div>

      {tab === "Maintenance" ? (
        <>
          <Card>
            <CardContent className="p-4">
              <form
                className="space-y-3"
                onSubmit={async (e) => {
                  e.preventDefault();
                  const fd = new FormData(e.currentTarget);
                  const done = await run(
                    () =>
                      post("/api/maintenance/tickets", {
                        ...(leaseId ? { leaseId } : {}),
                        category: fd.get("category"),
                        priority: fd.get("priority"),
                        title: fd.get("title"),
                        description: fd.get("description")
                      }),
                    "Ticket raised"
                  );
                  if (done) (e.target as HTMLFormElement).reset();
                }}
              >
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="t-cat">Category</Label>
                    <Select id="t-cat" name="category" defaultValue="plumbing">
                      {["plumbing", "electrical", "appliance", "furniture", "internet", "other"].map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="t-pri">Priority</Label>
                    <Select id="t-pri" name="priority" defaultValue="medium">
                      {["low", "medium", "high", "urgent"].map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                    </Select>
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="t-title">What is wrong?</Label>
                  <Input id="t-title" name="title" minLength={3} required placeholder="Kitchen tap leaking" />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="t-desc">Details</Label>
                  <Textarea id="t-desc" name="description" rows={3} required placeholder="Since yesterday evening, under the sink…" />
                </div>
                <Button type="submit" className="w-full" disabled={busy}>
                  Raise ticket
                </Button>
              </form>
            </CardContent>
          </Card>
          <div className="space-y-2">
            {tickets.map((t) => (
              <div key={t.id} className="flex items-center justify-between rounded-md border px-3 py-2 text-sm">
                <div>
                  <p className="font-medium">{t.title}</p>
                  <p className="text-xs text-muted-foreground">
                    {t.code}
                    {t.slaDueAt ? ` · ${tUi("due")} ${t.slaDueAt.slice(0, 16).replace("T", " ")}` : ""}
                  </p>
                </div>
                <Badge variant={["open", "assigned", "in_progress"].includes(t.status) ? "warning" : "secondary"}>{t.status.replace("_", " ")}</Badge>
              </div>
            ))}
            {tickets.length === 0 ? <p className="text-sm text-muted-foreground">{tUi("No tickets yet.")}</p> : null}
          </div>
        </>
      ) : null}

      {tab === "Complaints" ? (
        <>
          <Card>
            <CardContent className="p-4">
              <form
                className="space-y-3"
                onSubmit={async (e) => {
                  e.preventDefault();
                  const fd = new FormData(e.currentTarget);
                  const done = await run(
                    () =>
                      post("/api/complaints", {
                        memberProfileId: fd.get("memberProfileId"),
                        category: fd.get("category"),
                        priority: fd.get("priority"),
                        subject: fd.get("subject"),
                        description: fd.get("description")
                      }),
                    "Complaint filed"
                  );
                  if (done) (e.target as HTMLFormElement).reset();
                }}
              >
                <input type="hidden" name="memberProfileId" value={memberId} />
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="c-cat">Category</Label>
                    <Select id="c-cat" name="category" defaultValue="noise">
                      {["noise", "cleanliness", "neighbor", "staff", "facility", "billing", "other"].map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="c-pri">Priority</Label>
                    <Select id="c-pri" name="priority" defaultValue="medium">
                      {["low", "medium", "high"].map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                    </Select>
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="c-subj">Subject</Label>
                  <Input id="c-subj" name="subject" minLength={3} required placeholder="Loud music after midnight" />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="c-desc">What happened?</Label>
                  <Textarea id="c-desc" name="description" rows={3} required />
                </div>
                <Button type="submit" className="w-full" disabled={busy}>
                  File complaint
                </Button>
              </form>
            </CardContent>
          </Card>
          <div className="space-y-2">
            {complaints.map((c) => (
              <div key={c.id} className="flex items-center justify-between rounded-md border px-3 py-2 text-sm">
                <div>
                  <p className="font-medium">{c.subject}</p>
                  <p className="text-xs text-muted-foreground">{c.code}</p>
                </div>
                <Badge variant={["new", "acknowledged", "in_progress"].includes(c.status) ? "warning" : "secondary"}>{c.status.replace("_", " ")}</Badge>
              </div>
            ))}
            {complaints.length === 0 ? <p className="text-sm text-muted-foreground">{tUi("No complaints filed.")}</p> : null}
          </div>
        </>
      ) : null}

      {tab === "Room move" ? (
        <Card>
          <CardContent className="p-4">
            {leaseId && leaseStatus === "active" ? (
              <form
                className="space-y-3"
                onSubmit={async (e) => {
                  e.preventDefault();
                  const fd = new FormData(e.currentTarget);
                  const effectiveAt = new Date(String(fd.get("effectiveAt")));
                  await run(
                    () =>
                      post("/api/room-moves", {
                        fromLeaseId: leaseId,
                        toRoomId: fd.get("toRoomId"),
                        effectiveAt: Number.isNaN(effectiveAt.getTime()) ? "" : effectiveAt.toISOString(),
                        note: fd.get("note") || undefined
                      }),
                    "Room-move requested — staff will review"
                  );
                }}
              >
                <div className="space-y-1.5">
                  <Label htmlFor="m-room">Move to</Label>
                  <Select id="m-room" name="toRoomId" required>
                    {rooms.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.label}
                      </option>
                    ))}
                  </Select>
                  {rooms.length === 0 ? <p className="text-xs text-muted-foreground">{tUi("No vacant rooms right now.")}</p> : null}
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="m-eff">Effective from</Label>
                  <Input id="m-eff" name="effectiveAt" type="datetime-local" required />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="m-note">Note (optional)</Label>
                  <Input id="m-note" name="note" maxLength={300} placeholder="Quieter room preferred" />
                </div>
                <Button type="submit" className="w-full" disabled={busy || rooms.length === 0}>
                  Request room move
                </Button>
              </form>
            ) : (
              <p className="text-sm text-muted-foreground">{tUi("Room moves need an active lease.")}</p>
            )}
          </CardContent>
        </Card>
      ) : null}

      {tab === "Move-out" ? (
        <Card>
          <CardContent className="p-4">
            {leaseId ? (
              leaseStatus === "active" ? (
                <form
                  className="space-y-3"
                  onSubmit={async (e) => {
                    e.preventDefault();
                    const fd = new FormData(e.currentTarget);
                    const end = String(fd.get("endDate"));
                    await run(
                      () => post("/api/portal/notices", { leaseId, ...(end ? { endDate: new Date(end).toISOString() } : {}) }),
                      "Notice given — reception will confirm your move-out"
                    );
                  }}
                >
                  <p className="text-sm text-muted-foreground">
                    {tUi('Giving notice sets your lease to "notice". Settle open invoices and book a move-out inspection to finish.')}
                  </p>
                  <div className="space-y-1.5">
                    <Label htmlFor="n-end">Intended end date</Label>
                    <Input id="n-end" name="endDate" type="date" />
                  </div>
                  <Button type="submit" className="w-full" variant="destructive" disabled={busy}>
                    Give notice
                  </Button>
                </form>
              ) : (
                <p className="text-sm text-muted-foreground">
                  {tUi("Your lease is already in notice ({status}).").replace("{status}", tUi(leaseStatus ?? ""))}
                </p>
              )
            ) : (
              <p className="text-sm text-muted-foreground">{tUi("No lease on file.")}</p>
            )}
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
