"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Input, Label, Select } from "@/components/ui/input";
import { useToast } from "@/components/toast";

async function post(url: string, body: unknown): Promise<{ ok: boolean; message?: string }> {
  const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const data = (await res.json().catch(() => ({}))) as { message?: string };
  return { ok: res.ok, message: data.message };
}

/// M21 admin actions: bind a staff chat (STAFF holds no M21 grant, §M21) and
/// run the dispatch/digest jobs.
export function TelegramActions({ staff }: { staff: Array<{ id: string; name: string }> }) {
  const router = useRouter();
  const { push } = useToast();
  const [busy, setBusy] = useState(false);

  async function run(fn: () => Promise<{ ok: boolean; message?: string }>, okTitle: string) {
    setBusy(true);
    const r = await fn();
    setBusy(false);
    if (!r.ok) {
      push({ title: "Failed", description: r.message, variant: "destructive" });
      return;
    }
    push({ title: okTitle, variant: "success" });
    router.refresh();
  }

  return (
    <div className="mb-4 flex flex-wrap gap-2">
      <AdminLinkDialog staff={staff} busy={busy} onRun={run} />
      <Button size="sm" variant="outline" disabled={busy} onClick={() => void run(() => post("/api/jobs/telegram-dispatch", {}), "Dispatch drained")}>
        Run dispatch
      </Button>
      <Button size="sm" variant="outline" disabled={busy} onClick={() => void run(() => post("/api/jobs/telegram-dispatch", { digest: true }), "Occupancy digest sent")}>
        Send occupancy digest
      </Button>
    </div>
  );
}

function AdminLinkDialog({ staff, busy, onRun }: { staff: Array<{ id: string; name: string }>; busy: boolean; onRun: (fn: () => Promise<{ ok: boolean; message?: string }>, t: string) => Promise<void> }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button size="sm" onClick={() => setOpen(true)}>
        Link staff chat…
      </Button>
      <Dialog open={open} onClose={() => setOpen(false)} title="Bind a staff chat" description="Staff hold no M21 grant — an admin binds their Telegram chat for ops notifications (low stock, digests).">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const fd = new FormData(e.currentTarget);
            void onRun(
              () =>
                post("/api/telegram/admin-link", {
                  chatId: String(fd.get("chatId")).trim(),
                  telegramUserId: String(fd.get("telegramUserId")).trim() || undefined,
                  userId: String(fd.get("userId"))
                }),
              "Chat linked"
            ).then(() => setOpen(false));
          }}
          className="space-y-4"
        >
          <div className="space-y-1.5">
            <Label htmlFor="tg-chat">Chat ID</Label>
            <Input id="tg-chat" name="chatId" required placeholder="123456789" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="tg-user">Staff user</Label>
            <Select id="tg-user" name="userId" required>
              {staff.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name}
                </option>
              ))}
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="tg-tgid">Telegram user id (optional)</Label>
            <Input id="tg-tgid" name="telegramUserId" placeholder="987654321" />
          </div>
          <Button type="submit" disabled={busy}>
            Bind chat
          </Button>
        </form>
      </Dialog>
    </>
  );
}
