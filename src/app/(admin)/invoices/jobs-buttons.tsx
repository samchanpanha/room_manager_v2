"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/toast";

interface GenSummary {
  generated: number;
  skipped: number;
  invoices: Array<{ code: string; leaseCode: string; totalMinor: number }>;
}

export function JobsButtons({ canGenerate, canRunDaily }: { canGenerate: boolean; canRunDaily: boolean }) {
  const router = useRouter();
  const { push } = useToast();
  const [busy, setBusy] = useState(false);

  async function run(url: string, title: string) {
    setBusy(true);
    try {
      const res = await fetch(url, { method: "POST" });
      const data = (await res.json().catch(() => ({}))) as Record<string, unknown> & { message?: string };
      if (!res.ok) {
        push({ title, description: data.message ?? "Job failed", variant: "destructive" });
        return;
      }
      if (url.includes("generation")) {
        const s = data as unknown as GenSummary;
        push({
          title: `${s.generated} invoice(s) generated`,
          description: s.generated > 0 ? s.invoices.slice(0, 3).map((i) => `${i.code} (${i.leaseCode})`).join(", ") : `${s.skipped} already billed`,
          variant: "success"
        });
      } else {
        const lf = data.lateFees as { applied: number };
        const dn = data.dunning as { overdueMarked: number; remindersSent: number };
        push({
          title: "Daily billing job done",
          description: `late fees: ${lf.applied} · overdue: ${dn.overdueMarked} · reminders: ${dn.remindersSent}`,
          variant: "success"
        });
      }
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex gap-2">
      {canRunDaily ? (
        <Button variant="outline" disabled={busy} onClick={() => run("/api/jobs/billing-daily", "Daily job failed")}>
          {busy ? "Running…" : "Run daily job (late fees + dunning)"}
        </Button>
      ) : null}
      {canGenerate ? (
        <Button disabled={busy} onClick={() => run("/api/jobs/invoice-generation", "Generation failed")}>
          {busy ? "Running…" : "Run generation job"}
        </Button>
      ) : null}
    </div>
  );
}
