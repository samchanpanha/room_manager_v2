"use client";

import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input, Label, Select } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/toast";
import { Tx } from "@/components/i18n-text";

export interface UrgentSettlementPreviewData {
  lease: {
    id: string;
    code: string;
    status: string;
    startDate: string;
    endDate: string | null;
    rentAmountMinor: number;
    billingCycleDay: number;
    noticeDays: number;
    room: {
      id: string;
      number: string;
      buildingName: string;
      propertyName: string;
      propertyCode: string;
    };
  };
  member: {
    id: string;
    name: string;
    email: string | null;
    phone: string | null;
  };
  openDuesMinor: number;
  openInvoices: Array<{
    id: string;
    code: string;
    status: string;
    amountDueMinor: number;
    totalMinor: number;
    periodStart: string;
    periodEnd: string;
  }>;
  unbilledRentMinor: number;
  unbilledDays: number;
  unbilledPeriod: {
    start: string;
    end: string;
  } | null;
  unbilledUtilitiesMinor: number;
  pendingUtilitiesList: Array<{
    id: string;
    name: string;
    amountMinor: number;
    type: "utility" | "service";
  }>;
  depositHeldMinor: number;
  hasMoveOutInspection: boolean;
  totalGrossDueMinor: number;
  suggestedNetPayableMinor: number;
  suggestedDepositRefundMinor: number;
}

export function UrgentSettlementDialog({
  open,
  onClose,
  leaseId,
  leaseCode
}: {
  open: boolean;
  onClose: () => void;
  leaseId: string;
  leaseCode: string;
}) {
  const router = useRouter();
  const { push } = useToast();
  const [loading, setLoading] = useState(true);
  const [preview, setPreview] = useState<UrgentSettlementPreviewData | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Form states
  const todayStr = new Date().toISOString().slice(0, 10);
  const [departureDate, setDepartureDate] = useState(todayStr);
  const [reason, setReason] = useState("Urgent relocation / emergency checkout");
  const [earlyTerminationFee, setEarlyTerminationFee] = useState<number>(0);
  const [damageFee, setDamageFee] = useState<number>(0);
  const [fastTrackInspection, setFastTrackInspection] = useState<boolean>(true);
  const [settlementMode, setSettlementMode] = useState<"direct_pay" | "deposit_offset" | "combo" | "zero_due" | "qr_pay">("direct_pay");
  const [paymentMethod, setPaymentMethod] = useState<"cash" | "bank_transfer" | "qr" | "card" | "cheque">("cash");

  // QR-first (qr_pay) state: the pending QR payment + live webhook status.
  const [qrCharge, setQrCharge] = useState<{
    paymentId: string;
    paymentCode: string;
    amountMinor: number;
    imageDataUrl: string;
    expiresAt: string;
  } | null>(null);
  const [qrStatus, setQrStatus] = useState<"idle" | "awaiting" | "failed">("idle");
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const stopPolling = () => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  };

  function startQrPolling(paymentId: string) {
    stopPolling();
    pollRef.current = setInterval(async () => {
      const r = await fetch(`/api/payments/${paymentId}`);
      if (!r.ok) return;
      const s = (await r.json()) as { payment: { status: string } };
      if (s.payment.status === "confirmed") {
        stopPolling();
        push({ title: `⚡ Lease ${leaseCode} settled — QR confirmed!`, description: "Lease terminated after webhook confirmation.", variant: "success" });
        onClose();
        router.refresh();
      } else if (s.payment.status === "failed") {
        stopPolling();
        setQrStatus("failed");
      }
    }, 5000);
  }

  // Load preview data
  const loadPreview = useCallback(async (dateStr?: string) => {
    setLoading(true);
    try {
      const url = dateStr
        ? `/api/leases/${leaseId}/urgent-settlement?departureDate=${dateStr}`
        : `/api/leases/${leaseId}/urgent-settlement`;
      const res = await fetch(url);
      const json = await res.json();
      if (!res.ok) {
        push({ title: "Could not load settlement preview", description: json.message, variant: "destructive" });
        return;
      }
      setPreview(json);
      if (!json.hasMoveOutInspection) {
        setFastTrackInspection(true);
      }
      // Auto select mode based on deposit vs dues
      if (json.depositHeldMinor > 0 && json.depositHeldMinor >= json.totalGrossDueMinor) {
        setSettlementMode("deposit_offset");
      } else if (json.depositHeldMinor > 0) {
        setSettlementMode("combo");
      } else {
        setSettlementMode("direct_pay");
      }
    } catch {
      push({ title: "Network error loading settlement preview", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [leaseId, push]);

  useEffect(() => {
    if (open) {
      stopPolling();
      setQrCharge(null);
      setQrStatus("idle");
      void loadPreview(departureDate);
    }
  }, [open, loadPreview, departureDate]);

  // Live calculations
  const totalAdditionalChargesMinor = (Number(earlyTerminationFee) || 0) * 100 + (Number(damageFee) || 0) * 100;
  const currentTotalGrossDueMinor = (preview?.totalGrossDueMinor ?? 0) + totalAdditionalChargesMinor;
  const depositHeldMinor = preview?.depositHeldMinor ?? 0;

  const { offsetMinor, netPayableMinor, refundMinor } = useMemo(() => {
    let offset = 0;
    if ((settlementMode === "deposit_offset" || settlementMode === "combo") && depositHeldMinor > 0) {
      offset = Math.min(depositHeldMinor, currentTotalGrossDueMinor);
    }
    const payable = Math.max(0, currentTotalGrossDueMinor - offset);
    const refund = Math.max(0, depositHeldMinor - offset);
    return {
      offsetMinor: offset,
      netPayableMinor: payable,
      refundMinor: refund
    };
  }, [settlementMode, depositHeldMinor, currentTotalGrossDueMinor]);

  const money = (minor: number) =>
    new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(minor / 100);

  async function handleExecute(e: React.FormEvent) {
    e.preventDefault();
    if (!reason || reason.trim().length < 3) {
      push({ title: "Reason required", description: "Please enter a departure reason (at least 3 characters)", variant: "destructive" });
      return;
    }

    setSubmitting(true);
    try {
      const body: Record<string, unknown> = {
        departureDate,
        reason,
        earlyTerminationFee: Number(earlyTerminationFee) || 0,
        damageFee: Number(damageFee) || 0,
        fastTrackInspection,
        settlementMode
      };
      if (settlementMode === "qr_pay") {
        // QR-first: the gateway webhook confirms the money and the lease then
        // terminates. No counter amount/method — the QR is the full balance.
      } else {
        body.paymentMethod = paymentMethod;
        body.amountPaid = netPayableMinor > 0 ? netPayableMinor / 100 : 0;
      }

      const res = await fetch(`/api/leases/${leaseId}/urgent-settlement`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body)
      });

      const data = (await res.json()) as {
        ok?: boolean;
        message?: string;
        notes?: string[];
        awaitingPayment?: boolean;
        paymentId?: string;
        paymentCode?: string;
        qrImageDataUrl?: string;
        qrAmountMinor?: number;
        qrExpiresAt?: string;
      };
      if (!res.ok) {
        push({
          title: "Urgent settlement failed",
          description: data.message || "Failed to process checkout",
          variant: "destructive"
        });
        return;
      }

      if (data.awaitingPayment && data.paymentId) {
        setQrCharge({
          paymentId: data.paymentId,
          paymentCode: data.paymentCode ?? "",
          amountMinor: data.qrAmountMinor ?? 0,
          imageDataUrl: data.qrImageDataUrl ?? "",
          expiresAt: data.qrExpiresAt ?? new Date().toISOString()
        });
        setQrStatus("awaiting");
        startQrPolling(data.paymentId);
        return;
      }

      push({
        title: `⚡ Lease ${leaseCode} urgently settled & terminated!`,
        description: data.notes?.slice(0, 3).join(" · "),
        variant: "success"
      });

      onClose();
      router.refresh();
    } catch {
      push({ title: "Error submitting urgent settlement", variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog
      open={open}
      onClose={() => {
        stopPolling();
        onClose();
      }}
      title={`⚡ Urgent Paid & Fast-Track Leave — ${leaseCode}`}
      description="Instant departure clearance: generates prorated final invoice, collects counter/QR payment or applies deposit offset, passes inspection, and terminates lease."
      wide
    >
      {qrCharge ? (
        <div className="space-y-4 py-4">
          <div className="flex flex-col items-center gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={qrCharge.imageDataUrl} alt={`Urgent settlement QR ${qrCharge.paymentCode}`} className="h-64 w-64 rounded-lg border bg-white p-2" />
            <div className="text-center text-sm">
              <p className="font-semibold tabular-nums">{money(qrCharge.amountMinor)}</p>
              <p className="font-mono text-xs text-muted-foreground">{qrCharge.paymentCode}</p>
              <p className="text-xs text-muted-foreground">
                <Tx>Full outstanding balance — single scan covers every open invoice (oldest-first).</Tx>
              </p>
              {qrStatus === "awaiting" ? (
                <p className="mt-2 text-xs text-muted-foreground">
                  <Tx>Waiting for the payment gateway… the lease terminates automatically once confirmed.</Tx>
                </p>
              ) : qrStatus === "failed" ? (
                <p className="mt-2 text-xs font-medium text-destructive">
                  <Tx>Payment failed — close and reopen this settlement to generate a fresh QR.</Tx>
                </p>
              ) : null}
            </div>
          </div>
          <div className="flex justify-end gap-2 border-t pt-4">
            <Button type="button" variant="outline" onClick={() => { stopPolling(); onClose(); }}>
              <Tx>Done (keep lease on notice)</Tx>
            </Button>
          </div>
        </div>
      ) : loading ? (
        <div className="py-12 text-center text-sm text-muted-foreground animate-pulse">
          <Tx>Auditing open invoices, rent proration, and held deposits…</Tx>
        </div>
      ) : preview ? (
        <form onSubmit={handleExecute} className="space-y-5">
          {/* Member & Room Header Summary */}
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border bg-muted/40 p-3.5 text-xs sm:text-sm">
            <div>
              <span className="text-muted-foreground"><Tx>Member</Tx>: </span>
              <span className="font-semibold text-foreground">{preview.member.name}</span>
              <span className="text-muted-foreground"> ({preview.member.phone || preview.member.email || "No contact"})</span>
            </div>
            <div>
              <span className="text-muted-foreground"><Tx>Room</Tx>: </span>
              <span className="font-semibold font-mono text-foreground">
                {preview.lease.room.propertyName} / Room {preview.lease.room.number}
              </span>
            </div>
          </div>

          {/* Departure Date & Reason */}
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="urg-date"><Tx>Departure Date</Tx></Label>
              <Input
                id="urg-date"
                type="date"
                value={departureDate}
                onChange={(e) => {
                  setDepartureDate(e.target.value);
                  void loadPreview(e.target.value);
                }}
                required
              />
              <span className="text-[11px] text-muted-foreground">
                <Tx>Rent is prorated up to this date.</Tx>
              </span>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="urg-reason"><Tx>Urgent Leave Reason</Tx> <span className="text-destructive">*</span></Label>
              <Input
                id="urg-reason"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="e.g. Emergency personal relocation"
                required
                minLength={3}
              />
            </div>
          </div>

          {/* Audit Breakdown Card */}
          <div className="rounded-lg border bg-card p-4 space-y-3">
            <div className="flex items-center justify-between border-b pb-2">
              <span className="text-sm font-semibold text-foreground"><Tx>Financial & Dues Breakdown</Tx></span>
              <span className="text-xs text-muted-foreground font-mono"><Tx>Auto-Audited</Tx></span>
            </div>

            <div className="space-y-2 text-xs sm:text-sm divide-y">
              {/* Existing Open Dues */}
              <div className="flex justify-between items-center pt-1.5">
                <div>
                  <span className="text-foreground"><Tx>Open Invoices Balance</Tx></span>
                  <p className="text-[11px] text-muted-foreground">
                    {preview.openInvoices.length > 0
                      ? `${preview.openInvoices.length} unpaid invoice(s)`
                      : "No past due invoices"}
                  </p>
                </div>
                <span className="font-mono tabular-nums font-medium text-foreground">
                  {money(preview.openDuesMinor)}
                </span>
              </div>

              {/* Unbilled Prorated Rent */}
              <div className="flex justify-between items-center pt-1.5">
                <div>
                  <span className="text-foreground"><Tx>Prorated Final Rent & Services</Tx></span>
                  <p className="text-[11px] text-muted-foreground">
                    {preview.unbilledPeriod
                      ? `${preview.unbilledPeriod.start} → ${preview.unbilledPeriod.end} (${preview.unbilledDays} days)`
                      : "Already billed up to date"}
                  </p>
                </div>
                <span className="font-mono tabular-nums font-medium text-foreground">
                  +{money(preview.unbilledRentMinor)}
                </span>
              </div>

              {/* Pending Utilities */}
              {preview.unbilledUtilitiesMinor > 0 ? (
                <div className="flex justify-between items-center pt-1.5">
                  <div>
                    <span className="text-foreground"><Tx>Pending Utility & Service Usages</Tx></span>
                    <p className="text-[11px] text-muted-foreground">
                      {preview.pendingUtilitiesList.map((p) => p.name).join(", ")}
                    </p>
                  </div>
                  <span className="font-mono tabular-nums font-medium text-foreground">
                    +{money(preview.unbilledUtilitiesMinor)}
                  </span>
                </div>
              ) : null}

              {/* Security Deposit Held */}
              <div className="flex justify-between items-center pt-1.5 text-primary">
                <div>
                  <span className="font-medium"><Tx>Security Deposit Held</Tx></span>
                  <p className="text-[11px] text-muted-foreground"><Tx>M10 Deposit Liability on File</Tx></p>
                </div>
                <span className="font-mono tabular-nums font-semibold">
                  {money(preview.depositHeldMinor)}
                </span>
              </div>
            </div>
          </div>

          {/* Adjustments: Early Exit Penalty & Damage Fees */}
          <div className="grid gap-3 sm:grid-cols-2 rounded-lg border bg-muted/20 p-3.5">
            <div className="space-y-1.5">
              <Label htmlFor="urg-exit-fee" className="text-xs">
                <Tx>Early Exit / Contract Break Fee</Tx> ($)
              </Label>
              <Input
                id="urg-exit-fee"
                type="number"
                step="0.01"
                min="0"
                value={earlyTerminationFee || ""}
                onChange={(e) => setEarlyTerminationFee(parseFloat(e.target.value) || 0)}
                placeholder="0.00"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="urg-damage-fee" className="text-xs">
                <Tx>Move-Out Damage / Repair Charges</Tx> ($)
              </Label>
              <Input
                id="urg-damage-fee"
                type="number"
                step="0.01"
                min="0"
                value={damageFee || ""}
                onChange={(e) => setDamageFee(parseFloat(e.target.value) || 0)}
                placeholder="0.00"
              />
            </div>
          </div>

          {/* Move-Out Inspection Gate */}
          <div className="rounded-lg border p-3.5 flex flex-wrap items-center justify-between gap-3 bg-card">
            <div className="space-y-0.5">
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold"><Tx>Move-Out Inspection (M18)</Tx></span>
                {preview.hasMoveOutInspection ? (
                  <Badge variant="success"><Tx>Completed ✓</Tx></Badge>
                ) : (
                  <Badge variant="warning"><Tx>Pending</Tx></Badge>
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                {preview.hasMoveOutInspection
                  ? "Move-out inspection already completed on file."
                  : "Lease ending requires a move-out inspection."}
              </p>
            </div>

            {!preview.hasMoveOutInspection ? (
              <label className="flex items-center gap-2 text-xs font-medium cursor-pointer">
                <input
                  type="checkbox"
                  checked={fastTrackInspection}
                  onChange={(e) => setFastTrackInspection(e.target.checked)}
                  className="rounded border-input text-primary focus:ring-primary h-4 w-4"
                />
                <span><Tx>⚡ Fast-Track Pass Move-Out Inspection</Tx></span>
              </label>
            ) : null}
          </div>

          {/* Settlement Mode & Payment Method */}
          <div className="rounded-lg border p-4 bg-muted/30 space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold"><Tx>Settlement & Payment Strategy</Tx></span>
              <span className="text-xs font-semibold text-primary uppercase">
                {settlementMode.replace("_", " ")}
              </span>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="urg-mode"><Tx>Settlement Mode</Tx></Label>
                <Select
                  id="urg-mode"
                  value={settlementMode}
                  onChange={(e) => setSettlementMode(e.target.value as "direct_pay" | "deposit_offset" | "combo" | "zero_due" | "qr_pay")}
                >
                  <option value="direct_pay">💵 Pay Full Balance at Counter / QR</option>
                  <option value="qr_pay">📱 Scan-to-Pay QR (full balance, settle on webhook)</option>
                  {depositHeldMinor > 0 ? (
                    <>
                      <option value="deposit_offset">🛡️ Offset from Deposit Only</option>
                      <option value="combo">⚖️ Combo: Offset Deposit + Pay Rest</option>
                    </>
                  ) : null}
                  <option value="zero_due">✓ Zero Due Settlement</option>
                </Select>
              </div>

              {netPayableMinor > 0 ? (
                <div className="space-y-1.5">
                  <Label htmlFor="urg-method"><Tx>Payment Method</Tx></Label>
                  <Select
                    id="urg-method"
                    value={paymentMethod}
                    onChange={(e) => setPaymentMethod(e.target.value as "cash" | "bank_transfer" | "qr" | "card" | "cheque")}
                  >
                    <option value="cash">Cash (Counter)</option>
                    <option value="qr">KHQR / Dynamic QR</option>
                    <option value="bank_transfer">Bank Transfer</option>
                    <option value="card">Credit / Debit Card</option>
                    <option value="cheque">Cheque</option>
                  </Select>
                </div>
              ) : null}
            </div>

            {/* Net Settlement Totals Summary Card */}
            <div className="rounded border bg-background p-3.5 space-y-2 text-sm">
              <div className="flex justify-between text-muted-foreground">
                <span><Tx>Total Gross Charges Due</Tx>:</span>
                <span className="font-mono tabular-nums font-medium text-foreground">{money(currentTotalGrossDueMinor)}</span>
              </div>
              {offsetMinor > 0 ? (
                <div className="flex justify-between text-primary">
                  <span><Tx>Deposit Offset Applied</Tx>:</span>
                  <span className="font-mono tabular-nums font-semibold">−{money(offsetMinor)}</span>
                </div>
              ) : null}
              <div className="flex justify-between border-t pt-2 text-base font-bold">
                <span className={netPayableMinor > 0 ? "text-destructive" : "text-success"}>
                  {netPayableMinor > 0 ? <Tx>Amount to Pay Now</Tx> : <Tx>Net Balance Cleared ($0.00)</Tx>}:
                </span>
                <span className="font-mono tabular-nums text-lg">
                  {money(netPayableMinor)}
                </span>
              </div>
              {refundMinor > 0 ? (
                <div className="flex justify-between text-xs text-muted-foreground pt-1">
                  <span><Tx>Deposit Refund Remaining (M10)</Tx>:</span>
                  <span className="font-mono tabular-nums text-foreground font-semibold">
                    {money(refundMinor)}
                  </span>
                </div>
              ) : null}
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-wrap items-center justify-between gap-3 border-t pt-4">
            <Button type="button" variant="outline" onClick={onClose} disabled={submitting}>
              <Tx>Cancel</Tx>
            </Button>

            <Button
              type="submit"
              variant="success"
              disabled={submitting || (!fastTrackInspection && !preview.hasMoveOutInspection)}
              className="gap-2"
            >
              {submitting ? (
                <Tx>Processing Settlement & Checkout…</Tx>
              ) : settlementMode === "qr_pay" ? (
                <>
                  <span>📱</span>
                  <Tx>Open Scan-to-Pay QR</Tx> ({money(netPayableMinor)})
                </>
              ) : (
                <>
                  <span>⚡</span>
                  <Tx>Execute Urgent Settlement & Checkout</Tx> ({money(netPayableMinor)})
                </>
              )}
            </Button>
          </div>
        </form>
      ) : null}
    </Dialog>
  );
}
