package com.rentmanager.billing.qrpay;

import java.time.Instant;

/**
 * M13 QR-payments provider adapter — the Java port of the {@code QrProvider}
 * interface in {@code src/lib/qrpay/adapter.ts}. Real providers (gateway payment
 * links, PromptPay, QRIS, UPI) implement the same two operations and register
 * themselves in {@link QrProviderRegistry}; DevMock is the default (§M13
 * "DevMock first").
 */
public interface QrProvider {

  /** Provider name echoed back on the QR/webhook (e.g. {@code "devmock"}). */
  String name();

  /** Build the QR charge (payload + rendered PNG data URL + expiry). */
  QrCharge generateQR(QrChargeInput input);

  /**
   * Map a provider webhook body onto the generic payment-webhook shape, or
   * {@code null} when the payload is not from this provider / is malformed.
   */
  NormalizedWebhook parseWebhook(Object payload);

  /** Charge request: amount (minor units), stable ref, org payout descriptor. */
  record QrChargeInput(int amountMinor, String ref, String orgAccount, Integer expiresInSec) {
    /** Default validity window: 15 minutes (matches adapter.ts). */
    public int expiresInSecOrDefault() {
      return expiresInSec != null ? expiresInSec : 900;
    }
  }

  /** The rendered charge: provider name, scan payload, PNG data URL, expiry. */
  record QrCharge(String provider, String qrString, String imageDataUrl, Instant expiresAt) {}

  /** Normalized webhook: references + terminal status (confirmed | failed). */
  record NormalizedWebhook(String provider, String paymentId, String gatewayRef,
      String idempotencyKey, String status, String reason) {}
}
