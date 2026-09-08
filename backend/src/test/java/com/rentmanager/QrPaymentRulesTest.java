package com.rentmanager;

import static org.assertj.core.api.Assertions.assertThat;

import com.rentmanager.billing.qrpay.DevMockQrProvider;
import com.rentmanager.billing.qrpay.MemberQrTokens;
import com.rentmanager.billing.qrpay.QrCodeRenderer;
import com.rentmanager.billing.qrpay.QrProvider;
import com.rentmanager.billing.qrpay.QrProviderRegistry;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;

/**
 * Ports the M13 QR-payment adapter + token tests from {@code src/lib/qrpay/*}
 * so both stacks encode the same QR payloads, verify the same signed member
 * tokens, and normalize the same webhook payloads.
 */
class QrPaymentRulesTest {

  private final QrCodeRenderer renderer = new QrCodeRenderer();
  private final DevMockQrProvider devmock = new DevMockQrProvider(renderer);
  private final QrProviderRegistry registry = new QrProviderRegistry(List.of(devmock), devmock);

  @Test
  void devMockEncodesDeepLinkAndRendersPng() {
    QrProvider.QrCharge charge = devmock.generateQR(
        new QrProvider.QrChargeInput(12500, "QRPAY-ABCDE", "Acme Rentals", null));
    assertThat(charge.provider()).isEqualTo("devmock");
    assertThat(charge.qrString())
        .isEqualTo("devmock://pay?ref=QRPAY-ABCDE&amt=12500&acct=Acme+Rentals");
    assertThat(charge.imageDataUrl()).startsWith("data:image/png;base64,");
    assertThat(charge.expiresAt()).isAfter(java.time.Instant.now());
  }

  @Test
  void devMockRejectsBadCharge() {
    assertThat(catchThrows(() -> devmock.generateQR(
        new QrProvider.QrChargeInput(0, "ref", "acct", null)))).isTrue();
    assertThat(catchThrows(() -> devmock.generateQR(
        new QrProvider.QrChargeInput(100, "", "acct", null)))).isTrue();
  }

  @Test
  void devMockParsesWebhookAndRejectsForeignPayloads() {
    QrProvider.NormalizedWebhook ok = devmock.parseWebhook(Map.of(
        "provider", "devmock", "type", "qr_payment", "ref", "QRPAY-1", "status", "success"));
    assertThat(ok).isNotNull();
    assertThat(ok.gatewayRef()).isEqualTo("QRPAY-1");
    assertThat(ok.status()).isEqualTo("confirmed");

    QrProvider.NormalizedWebhook failed = devmock.parseWebhook(Map.of(
        "provider", "devmock", "type", "qr_payment", "ref", "QRPAY-2", "status", "failed"));
    assertThat(failed).isNotNull();
    assertThat(failed.status()).isEqualTo("failed");

    assertThat(devmock.parseWebhook(Map.of("provider", "other", "ref", "x"))).isNull();
    assertThat(devmock.parseWebhook(Map.of("provider", "devmock", "type", "qr_payment",
        "ref", "x", "status", "unknown"))).isNull();
    assertThat(devmock.parseWebhook("not-an-object")).isNull();
  }

  @Test
  void registryResolvesKnownProviderAndFallsBackToDevMock() {
    assertThat(registry.resolve("devmock").name()).isEqualTo("devmock");
    assertThat(registry.resolve("nope").name()).isEqualTo("devmock"); // DevMock first
    assertThat(registry.resolve(null).name()).isEqualTo("devmock");
    assertThat(registry.isProviderName("devmock")).isTrue();
    assertThat(registry.isProviderName("nope")).isFalse();
    assertThat(registry.providerNames()).contains("devmock");
  }

  @Test
  void memberTokenSignsAndVerifiesRoundTrip() {
    MemberQrTokens tokens = new MemberQrTokens("test-webhook-secret", "https://pay.example.com/");
    String token = tokens.signMemberToken("mem_123");
    assertThat(token).startsWith("mem_123.");
    assertThat(tokens.verifyMemberToken(token)).isEqualTo("mem_123");

    // Tampered signature and unknown format are rejected.
    assertThat(tokens.verifyMemberToken("mem_123.deadbeef")).isNull();
    assertThat(tokens.verifyMemberToken("no-dot")).isNull();
    assertThat(tokens.verifyMemberToken(null)).isNull();

    // A different signing key must not validate another key's token.
    MemberQrTokens other = new MemberQrTokens("different-secret", "https://pay.example.com/");
    assertThat(other.verifyMemberToken(token)).isNull();

    // Pay URL is absolute and carries the URL-encoded token.
    assertThat(tokens.payUrl("mem_123")).startsWith("https://pay.example.com/pay?m=mem_123.");
  }

  private static boolean catchThrows(Runnable r) {
    try {
      r.run();
      return false;
    } catch (RuntimeException e) {
      return true;
    }
  }
}
