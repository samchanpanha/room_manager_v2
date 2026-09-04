/// M13 QR Payments — provider adapter interface (§M13) + DevMock
/// implementation. Real providers (gateway payment links, PromptPay, QRIS,
/// UPI) implement the same two functions and plug in via `resolveProvider`.
import QRCode from "qrcode";

export interface QrChargeInput {
  amountMinor: number;
  /// Stable payment reference (payment code or gateway ref) — the provider
  /// echoes it back on the webhook.
  ref: string;
  /// Organisation payout account descriptor shown/encoded by the provider.
  orgAccount: string;
  /// QR validity window in seconds (dynamic QRs expire; the portal then
  /// regenerates). Default 15 minutes.
  expiresInSec?: number;
}

export interface QrCharge {
  provider: string;
  /// Provider-specific payload encoded in the QR (what a banking app scans).
  qrString: string;
  /// Rendered QR as a PNG data URL (drop-in for <img> and react-pdf <Image>).
  imageDataUrl: string;
  expiresAt: Date;
}

export interface NormalizedWebhook {
  provider: string;
  paymentId?: string;
  gatewayRef?: string;
  idempotencyKey?: string;
  status: "confirmed" | "failed";
  reason?: string;
}

export interface QrProvider {
  name: string;
  generateQR(input: QrChargeInput): Promise<QrCharge>;
  /// Map a provider webhook body onto the generic payment-webhook shape.
  /// Returns null when the payload is not from this provider / malformed.
  parseWebhook(payload: unknown): NormalizedWebhook | null;
}

/// DevMock (§M13 "DevMock first"): deterministic fake provider. The QR
/// encodes a devmock:// deep link; "confirmation" is simulated by POSTing
/// the echoed payload to the signed webhook endpoint.
export const devMockProvider: QrProvider = {
  name: "devmock",
  async generateQR(input: QrChargeInput): Promise<QrCharge> {
    if (!Number.isInteger(input.amountMinor) || input.amountMinor <= 0) {
      throw new Error("INVALID: amountMinor must be a positive integer");
    }
    if (!input.ref) throw new Error("INVALID: ref is required");
    const qrString = `devmock://pay?ref=${encodeURIComponent(input.ref)}&amt=${input.amountMinor}&acct=${encodeURIComponent(input.orgAccount)}`;
    const imageDataUrl = await QRCode.toDataURL(qrString, { margin: 1, width: 240 });
    return {
      provider: "devmock",
      qrString,
      imageDataUrl,
      expiresAt: new Date(Date.now() + (input.expiresInSec ?? 900) * 1000)
    };
  },
  parseWebhook(payload: unknown): NormalizedWebhook | null {
    if (typeof payload !== "object" || payload === null) return null;
    const p = payload as Record<string, unknown>;
    if (p.provider !== "devmock" || p.type !== "qr_payment") return null;
    if (typeof p.ref !== "string" || p.ref.length === 0) return null;
    if (p.status !== "success" && p.status !== "failed") return null;
    return {
      provider: "devmock",
      gatewayRef: p.ref,
      idempotencyKey: typeof p.idempotencyKey === "string" ? p.idempotencyKey : undefined,
      status: p.status === "success" ? "confirmed" : "failed",
      reason: typeof p.reason === "string" ? p.reason : undefined
    };
  }
};

const PROVIDERS: Record<string, QrProvider> = { devmock: devMockProvider };

export function resolveProvider(name?: string | null): QrProvider {
  if (name && PROVIDERS[name]) return PROVIDERS[name];
  return devMockProvider; // DevMock first; real providers register here later
}

export function isProviderName(v: string): boolean {
  return v in PROVIDERS;
}

export const PROVIDER_NAMES = Object.keys(PROVIDERS);
