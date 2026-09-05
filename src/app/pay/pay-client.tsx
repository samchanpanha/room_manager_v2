"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog } from "@/components/ui/dialog";
import { useToast } from "@/components/toast";
import { Tx } from "@/components/i18n-text";

interface Dues {
  member: { id: string; name: string };
  invoices: {
    id: string;
    code: string;
    status: string;
    dueDate: string;
    totalMinor: number;
    amountDueMinor: number;
    periodStart: string;
    periodEnd: string;
  }[];
  totalDueMinor: number;
}

interface Charge {
  paymentId: string;
  paymentCode: string;
  amountMinor: number;
  imageDataUrl: string;
  expiresAt: string;
}

const usd = (minor: number) => `$${(minor / 100).toFixed(2)}`;

export function PayClient() {
  const { push } = useToast();
  const [dues, setDues] = useState<Dues | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [charge, setCharge] = useState<Charge | null>(null);
  const [payStatus, setPayStatus] = useState<"pending" | "confirmed" | "failed" | null>(null);
  const [busyInvoice, setBusyInvoice] = useState<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const token = typeof window !== "undefined" ? new URLSearchParams(window.location.search).get("m") : null;

  const stopPolling = () => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  };

  const loadDues = useCallback(async () => {
    if (!token) {
      setError("No pay token — scan the QR on your invoice or the poster.");
      return;
    }
    const res = await fetch("/api/qrpay/dues", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ m: token }) });
    const data = (await res.json().catch(() => ({}))) as Dues & { message?: string };
    if (!res.ok) {
      setError(data.message ?? "This QR is not valid");
      return;
    }
    setDues(data);
  }, [token]);

  useEffect(() => {
    void loadDues();
    return stopPolling;
  }, [loadDues]);

  async function pay(invoiceId: string) {
    if (!token) return;
    setBusyInvoice(invoiceId);
    const res = await fetch("/api/qrpay/pay", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ m: token, invoiceId }) });
    const data = (await res.json().catch(() => ({}))) as Charge & { message?: string };
    setBusyInvoice(null);
    if (!res.ok) {
      push({ title: "QR unavailable", description: data.message, variant: "destructive" });
      return;
    }
    setCharge(data);
    setPayStatus("pending");
    stopPolling();
    pollRef.current = setInterval(async () => {
      const r = await fetch("/api/qrpay/status", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ m: token, paymentId: data.paymentId }) });
      if (!r.ok) return;
      const s = (await r.json()) as { status: string };
      if (s.status === "confirmed" || s.status === "failed") {
        stopPolling();
        setPayStatus(s.status);
        if (s.status === "confirmed") {
          push({ title: "Payment confirmed — thank you!", variant: "success" });
          void loadDues();
        }
      }
    }, 3000);
  }

  return (
    <main className="mx-auto max-w-xl px-4 py-10">
      <h1 className="text-2xl font-semibold tracking-tight"><Tx>Pay your bill</Tx></h1>
      <p className="mt-1 text-sm text-muted-foreground">
        <Tx>Scanned QR payment — no login needed. Confirmation is handled by the payment gateway (exactly once).</Tx>
      </p>

      {error ? (
        <Card className="mt-6">
          <CardContent className="p-6">
            <p className="text-sm font-medium text-destructive">{error}</p>
            <p className="mt-2 text-xs text-muted-foreground"><Tx>Ask reception for a fresh QR, or sign in to the resident portal.</Tx></p>
          </CardContent>
        </Card>
      ) : !dues ? (
        <Card className="mt-6">
          <CardContent className="p-6 text-sm text-muted-foreground"><Tx>Loading…</Tx></CardContent>
        </Card>
      ) : (
        <>
          <Card className="mt-6">
            <CardContent className="p-6">
              <p className="text-sm text-muted-foreground"><Tx>Paying as</Tx></p>
              <p className="text-lg font-semibold">{dues.member.name}</p>
              <p className="mt-3 text-3xl font-bold tabular-nums">{usd(dues.totalDueMinor)}</p>
              <p className="text-xs text-muted-foreground"><Tx>total outstanding across </Tx>{dues.invoices.length} <Tx>invoice(s)</Tx></p>
            </CardContent>
          </Card>

          <div className="mt-4 space-y-3">
            {dues.invoices.map((inv) => (
              <Card key={inv.id}>
                <CardContent className="flex items-center justify-between p-4">
                  <div>
                    <p className="font-mono text-xs font-medium">{inv.code}</p>
                    <p className="text-xs text-muted-foreground">
                      {inv.periodStart.slice(0, 10)} → {new Date(new Date(inv.periodEnd).getTime() - 86_400_000).toISOString().slice(0, 10)} <Tx>· due</Tx>{" "}
                      {inv.dueDate.slice(0, 10)}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="font-semibold tabular-nums">{usd(inv.amountDueMinor)}</span>
                    <Button size="sm" disabled={busyInvoice === inv.id} onClick={() => void pay(inv.id)}>
                      Pay by QR
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
            {dues.invoices.length === 0 ? (
              <Card>
                <CardContent className="p-6 text-sm text-muted-foreground"><Tx>Nothing outstanding — you are all settled up. 🎉</Tx></CardContent>
              </Card>
            ) : null}
          </div>
        </>
      )}

      <Dialog
        open={charge != null}
        onClose={() => {
          stopPolling();
          setCharge(null);
        }}
        title="Scan to pay"
        description={charge ? `${usd(charge.amountMinor)} · ${charge.paymentCode} — expires ${new Date(charge.expiresAt).toLocaleTimeString()}` : ""}
      >
        <div className="flex flex-col items-center gap-4">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={charge?.imageDataUrl} alt="Payment QR" className="h-64 w-64 rounded-lg border bg-white p-2" />
          {payStatus === "pending" ? <p className="text-sm text-muted-foreground"><Tx>Waiting for confirmation…</Tx></p> : null}
          {payStatus === "confirmed" ? <p className="text-sm font-medium text-success"><Tx>Payment confirmed!</Tx></p> : null}
          {payStatus === "failed" ? <p className="text-sm font-medium text-destructive"><Tx>Payment failed — please try again.</Tx></p> : null}
        </div>
      </Dialog>
    </main>
  );
}
