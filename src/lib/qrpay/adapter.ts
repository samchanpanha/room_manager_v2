/// M13 QR Payments — provider adapter interface (§M13). Implementations:
///   - `devmock`: deterministic fake provider used by default (acceptance-first).
///   - `aba`: ABA PayWay merchant-presented QR + PayWay callback normalizer.
///     Configured in Settings → Payment gateway; off until activated ("future"
///     enable switch). Serves as the blueprint for other gateways.
import QRCode from "qrcode";

export interface AbaQrConfig {
  storeName: string;
  merchantAccount: string;
  merchantId: string;
  countryCode: string;
  currency: string;
  billNumberPrefix: string;
}

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
  /// ABA PayWay merchant details (only used by the `aba` provider).
  aba?: AbaQrConfig;
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

/// EMVCo Merchant-Presented QR building blocks (used by the `aba` provider).
function emvTlv(tag: string, value: string): string {
  if (value.length > 99) throw new Error("QR value too long for EMVCo data object");
  return `${tag}${value.length.toString().padStart(2, "0")}${value}`;
}

function emvCrc(payloadWithoutCrc: string): string {
  let crc = 0xffff;
  for (let i = 0; i < payloadWithoutCrc.length; i++) {
    crc ^= payloadWithoutCrc.charCodeAt(i) << 8;
    for (let j = 0; j < 8; j++) {
      crc = crc & 0x8000 ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff;
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, "0");
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

/// ABA PayWay (Cambodia): merchant-presented EMVCo QR configured from
/// Settings → Payment gateway. While `aba.enabled` is off, generating with
/// this provider yields INVALID_CONFIG so nothing silently encodes an
/// unconfigured merchant. When ready, flip the switch + set webhook secret
/// (paymentCredentials) and PayWay callbacks normalize through parseWebhook.
export const abaPayWayProvider: QrProvider = {
  name: "aba",
  async generateQR(input: QrChargeInput): Promise<QrCharge> {
    if (!Number.isInteger(input.amountMinor) || input.amountMinor <= 0) {
      throw new Error("INVALID: amountMinor must be a positive integer");
    }
    const c = input.aba;
    if (!c) throw new Error("ABA PayWay not configured — add merchant details in Settings → Payment gateway");
    if (!c.storeName || !c.merchantId) {
      throw new Error("ABA PayWay merchant store name and merchant ID are required in Settings → Payment gateway");
    }

    const currency = c.currency === "KHR" ? "116" : "840";
    const decimals = c.currency === "KHR" ? 0 : 2;
    const amount = (input.amountMinor / (decimals ? 100 : 1)).toFixed(decimals);

    // ABA PayWay bill numbers are numeric — derive one deterministically from
    // the payment reference so the (future) PayWay callback maps back.
    const digits = (s: string) => s.replace(/\D/g, "");
    const prefix = digits(c.billNumberPrefix).slice(-2) || "99";
    const bill = `${prefix}${digits(input.ref).slice(-10).padStart(10, "0")}`;

    const merchantAccountInfo =
      emvTlv("00", "com.aba.payway") + // merchant GUID (replace with ABA-issued GUID on onboarding)
      emvTlv("01", c.merchantId) +
      emvTlv("02", c.merchantAccount);

    const base =
      emvTlv("00", "01") +
      emvTlv("01", "12") +
      emvTlv("26", merchantAccountInfo) +
      emvTlv("52", "5311") +
      emvTlv("53", currency) +
      emvTlv("54", amount) +
      emvTlv("58", (c.countryCode || "KH").toUpperCase().slice(0, 3)) +
      emvTlv("59", c.storeName.slice(0, 25)) +
      emvTlv("62", emvTlv("05", bill));

    const qrString = base + emvTlv("63", emvCrc(base));
    const imageDataUrl = await QRCode.toDataURL(qrString, { margin: 1, width: 240 });
    return {
      provider: "aba",
      qrString,
      imageDataUrl,
      expiresAt: new Date(Date.now() + (input.expiresInSec ?? 900) * 1000)
    };
  },
  parseWebhook(payload: unknown): NormalizedWebhook | null {
    if (typeof payload !== "object" || payload === null) return null;
    const p = payload as Record<string, unknown>;
    // ABA PayWay v2 callback shape: { merchant_trans_id, app_trans_id,
    // trans_id, status_code/ack, amount, currency, ... } — require a trans id
    // + a result field so we never misfire on unrelated payloads.
    const ref = p.merchant_trans_id ?? p.app_trans_id ?? p.trans_id;
    const result = p.ack ?? p.status_code ?? p.status;
    if (typeof ref !== "string" || ref.length === 0) return null;
    if (typeof result !== "string") return null;
    const ok = result === "00" || result === "0000" || result === "000" || result.toLowerCase() === "success";
    const failed = result === "01" || result === "02" || result === "failed" || result.toLowerCase().includes("fail");
    if (!ok && !failed) return null;
    return {
      provider: "aba",
      gatewayRef: ref,
      idempotencyKey: typeof p.app_trans_id === "string" ? p.app_trans_id : undefined,
      status: ok ? "confirmed" : "failed",
      reason: typeof p.status_msg === "string" ? p.status_msg : undefined
    };
  }
};

const PROVIDERS: Record<string, QrProvider> = { devmock: devMockProvider, aba: abaPayWayProvider };

export function resolveProvider(name?: string | null): QrProvider {
  if (name && PROVIDERS[name]) return PROVIDERS[name];
  return devMockProvider;
}

/// Default QR provider for this tenant: the ABA PayWay master switch decides —
/// off (default) keeps the deterministic DevMock provider; on uses ABA and
/// fails closed when the merchant is not configured (§M13 provider config).
export function resolveDefaultProvider(paymentGateway: { provider: string; aba: { enabled: boolean } }): string {
  if (paymentGateway.aba.enabled) return "aba";
  return paymentGateway.provider === "aba" ? "aba" : "devmock";
}

export function isProviderName(v: string): boolean {
  return v in PROVIDERS;
}

/// Best-effort normalization for a webhook payload that didn't carry the
/// generic §9.6 shape (e.g. a raw ABA PayWay callback) — tries each provider.
export function tryNormalizeWebhook(payload: unknown): NormalizedWebhook | null {
  if (typeof payload !== "object" || payload === null) return null;
  for (const provider of Object.values(PROVIDERS)) {
    const normalized = provider.parseWebhook(payload);
    if (normalized) return normalized;
  }
  return null;
}

export const PROVIDER_NAMES = Object.keys(PROVIDERS);