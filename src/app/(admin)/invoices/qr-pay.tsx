"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { useToast } from "@/components/toast";
import { formatMinor } from "@/lib/money";
import { Tx } from "@/components/i18n-text";

interface QrCharge {
  paymentId: string;
  paymentCode: string;
  amountMinor: number;
  provider: string;
  qrString: string;
  imageDataUrl: string;
  expiresAt: string;
}

/// "Pay by QR" (§M13): shows the dynamic QR for an open invoice and polls the
/// payment until the gateway confirms it (webhook + polling fallback).
export function QrPayButton({ invoiceId }: { invoiceId: string }) {
  const router = useRouter();
  const { push } = useToast();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [charge, setCharge] = useState<QrCharge | null>(null);
  const [status, setStatus] = useState<"pending" | "confirmed" | "failed" | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const stopPolling = () => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  };

  useEffect(() => () => stopPolling(), []);

  async function checkOnce(): Promise<"pending" | "confirmed" | "failed" | null> {
    if (!charge) return null;
    const res = await fetch(`/api/payments/${charge.paymentId}`);
    if (!res.ok) return null;
    const data = (await res.json()) as { status?: string };
    if (data.status === "confirmed" || data.status === "failed") return data.status;
    return data.status === "pending" ? "pending" : null;
  }

  async function openDialog() {
    setOpen(true);
    setBusy(true);
    const res = await fetch(`/api/invoices/${invoiceId}/qr`, { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
    const data = (await res.json().catch(() => ({}))) as QrCharge & { message?: string };
    setBusy(false);
    if (!res.ok) {
      push({ title: "QR unavailable", description: data.message, variant: "destructive" });
      setOpen(false);
      return;
    }
    setCharge(data);
    setStatus("pending");
    stopPolling();
    pollRef.current = setInterval(async () => {
      const s = await checkOnce();
      if (s === "confirmed") {
        stopPolling();
        setStatus("confirmed");
        push({ title: "Payment confirmed", description: `${data.paymentCode} · ${formatMinor(data.amountMinor)} received`, variant: "success" });
        router.refresh();
      } else if (s === "failed") {
        stopPolling();
        setStatus("failed");
      }
    }, 3000);
  }

  return (
    <>
      <Button size="sm" variant="secondary" onClick={() => void openDialog()} disabled={busy}>
        Pay by QR
      </Button>

      <Dialog
        open={open}
        onClose={() => {
          stopPolling();
          setOpen(false);
        }}
        title="Pay by QR"
        description={charge ? `Scan with your banking app — ${formatMinor(charge.amountMinor)} · ${charge.paymentCode} (ref ${charge.qrString.slice(0, 28)}…) · expires ${new Date(charge.expiresAt).toLocaleTimeString()}` : "Generating QR…"}
      >
        <div className="flex flex-col items-center gap-4">
          {charge ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={charge.imageDataUrl} alt="Payment QR" className="h-56 w-56 rounded-lg border bg-white p-2" />
          ) : (
            <div className="flex h-56 w-56 items-center justify-center rounded-lg border bg-muted text-sm text-muted-foreground">
              {busy ? "Generating…" : "—"}
            </div>
          )}
          {status === "pending" ? <p className="text-sm text-muted-foreground"><Tx>Waiting for confirmation… (checking every 3 s)</Tx></p> : null}
          {status === "confirmed" ? <p className="text-sm font-medium text-success"><Tx>Payment confirmed — thank you!</Tx></p> : null}
          {status === "failed" ? <p className="text-sm font-medium text-destructive"><Tx>The gateway reported a failure — generate a new QR.</Tx></p> : null}
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={async () => {
                const s = await checkOnce();
                if (s === "confirmed") {
                  stopPolling();
                  setStatus("confirmed");
                  push({ title: "Payment confirmed", variant: "success" });
                  router.refresh();
                } else {
                  push({ title: `Status: ${s ?? "unknown"}` });
                }
              }}
            >
              Check now
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => {
                stopPolling();
                setCharge(null);
                setStatus(null);
                void openDialog();
              }}
            >
              Regenerate
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            <Tx>Confirmation arrives via the signed gateway webhook; this dialog polls as a fallback (§M13). Exactly-once is guaranteed by the
            payment idempotency key — duplicate webhooks are ignored.</Tx>
          </p>
        </div>
      </Dialog>
    </>
  );
}
