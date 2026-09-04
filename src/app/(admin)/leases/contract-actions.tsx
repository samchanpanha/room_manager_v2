"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/toast";

export function OwnerContractActions({ contractId, code, status }: { contractId: string; code: string; status: string }) {
  const router = useRouter();
  const { push } = useToast();
  const [busy, setBusy] = useState(false);

  async function post(action: string, body?: unknown) {
    setBusy(true);
    const res = await fetch(`/api/owner-contracts/${contractId}/${action}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: body ? JSON.stringify(body) : undefined
    });
    const data = (await res.json().catch(() => ({}))) as { message?: string };
    setBusy(false);
    if (!res.ok) {
      push({ title: `${action} failed`, description: data.message, variant: "destructive" });
      return;
    }
    push({ title: `Contract ${code} ${action === "activate" ? "activated — building ownership synced" : "terminated"}`, variant: "success" });
    router.refresh();
  }

  return (
    <div className="flex justify-end gap-1.5">
      {status === "draft" ? (
        <Button size="sm" variant="success" disabled={busy} onClick={() => post("activate", undefined)}>
          Activate
        </Button>
      ) : null}
      {status === "active" ? (
        <Button
          size="sm"
          variant="outline"
          disabled={busy}
          onClick={() => {
            const reason = window.prompt("Termination reason (required):");
            if (!reason || reason.trim().length < 3) return;
            void post("terminate", { reason });
          }}
        >
          Terminate
        </Button>
      ) : null}
    </div>
  );
}
