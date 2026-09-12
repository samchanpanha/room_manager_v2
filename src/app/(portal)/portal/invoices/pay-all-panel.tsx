"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/toast";
import { useT } from "@/components/i18n-provider";

interface Charge {
  paymentId: string;
  paymentCode: string;
  amountMinor: number;
  provider: string;
  imageDataUrl: string;
  expiresAt: string;
}

/// §M25 pay-all: ONE QR covering every open invoice (Σ amountDueMinor), via
/// /api/portal/pay-all → createMemberPayAllQr (FIFO on confirm). Mirrors
/// PayPanel's poll flow; costs the same as a single invoice scan.
export function PayAllPanel({ totalMinor }: { totalMinor: number }) {
  const router = useRouter();
  const { push } = useToast();
  const { tUi } = useT();
  const [charge, setCharge] = useState<Charge | null>(null);
  const [status, setStatus] = useState<"idle" | "pending" | "confirmed" | "failed">("idle");
  const [busy, setBusy] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const stopPolling = () => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  };
  useEffect(() => stopPolling, []);

  async function payAll() {
    setBusy(true);
    const res = await fetch("/api/portal/pay-all", { method: "POST" });
    const data = (await res.json().catch(() => ({}))) as Charge & { message?: string };
    setBusy(false);
    if (!res.ok) {
      push({ title: "QR unavailable", description: data.message, variant: "destructive" });
      return;
    }
    setCharge(data);
    setStatus("pending");
    stopPolling();
    pollRef.current = setInterval(async () => {
      const r = await fetch(`/api/payments/${data.paymentId}`);
      if (!r.ok) return;
      const s = (await r.json()) as { payment: { status: string } };
      if (s.payment.status === "confirmed" || s.payment.status === "failed") {
        stopPolling();
        setStatus(s.payment.status === "confirmed" ? "confirmed" : "failed");
        if (s.payment.status === "confirmed") {
          push({ title: "Payment confirmed — thank you!", variant: "success" });
          router.refresh();
        }
      }
    }, 3000);
  }

  if (status === "confirmed") {
    return <p className="rounded-md border px-3 py-2 text-sm text-success">{tUi("Payment received — receipt filed.")}</p>;
  }

  if (charge) {
    return (
      <div className="space-y-3">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={charge.imageDataUrl}
          alt={tUi("Payment QR {code}").replace("{code}", charge.paymentCode)}
          className="mx-auto w-56 rounded-md border bg-white p-2"
        />
        <p className="text-center text-xs text-muted-foreground">
          {charge.provider} · ${(charge.amountMinor / 100).toFixed(2)} · {tUi("scan with your banking app")}
        </p>
        <p className="text-center text-sm">{status === "pending" ? tUi("Waiting for the payment gateway…") : tUi("Payment failed — try again.")}</p>
      </div>
    );
  }

  return (
    <Button className="w-full" size="lg" onClick={payAll} disabled={busy || totalMinor <= 0}>
      {busy
        ? tUi("Preparing QR…")
        : tUi("Pay all outstanding — {amount}").replace("{amount}", `$${(totalMinor / 100).toFixed(2)}`)}
    </Button>
  );
}