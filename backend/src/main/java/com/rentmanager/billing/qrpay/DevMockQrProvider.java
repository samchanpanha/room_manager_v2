package com.rentmanager.billing.qrpay;

import com.rentmanager.platform.web.ApiException;
import java.nio.charset.StandardCharsets;
import java.net.URLEncoder;
import java.time.Instant;
import java.util.Map;
import org.springframework.stereotype.Component;

/**
 * DevMock QR provider (§M13 "DevMock first"): a deterministic fake provider.
 * The QR encodes a {@code devmock://} deep link and "confirmation" is simulated
 * by POSTing the echoed payload to the signed webhook endpoint. Faithful port of
 * {@code devMockProvider} in {@code src/lib/qrpay/adapter.ts}.
 */
@Component
public class DevMockQrProvider implements QrProvider {

  private final QrCodeRenderer renderer;

  public DevMockQrProvider(QrCodeRenderer renderer) {
    this.renderer = renderer;
  }

  @Override
  public String name() {
    return "devmock";
  }

  @Override
  public QrCharge generateQR(QrChargeInput input) {
    if (input.amountMinor() <= 0) {
      throw new ApiException(400, "INVALID", "amountMinor must be a positive integer");
    }
    if (input.ref() == null || input.ref().isEmpty()) {
      throw new ApiException(400, "INVALID", "ref is required");
    }
    String qrString = "devmock://pay?ref=" + enc(input.ref())
        + "&amt=" + input.amountMinor()
        + "&acct=" + enc(input.orgAccount() == null ? "" : input.orgAccount());
    String imageDataUrl = renderer.toPngDataUrl(qrString);
    Instant expiresAt = Instant.now().plusSeconds(input.expiresInSecOrDefault());
    return new QrCharge("devmock", qrString, imageDataUrl, expiresAt);
  }

  @Override
  @SuppressWarnings("unchecked")
  public NormalizedWebhook parseWebhook(Object payload) {
    if (!(payload instanceof Map)) return null;
    Map<String, Object> p = (Map<String, Object>) payload;
    if (!"devmock".equals(str(p, "provider")) || !"qr_payment".equals(str(p, "type"))) return null;
    String ref = str(p, "ref");
    if (ref == null || ref.isEmpty()) return null;
    String status = str(p, "status");
    if (!"success".equals(status) && !"failed".equals(status)) return null;
    return new NormalizedWebhook(
        "devmock",
        null,
        ref,
        str(p, "idempotencyKey"),
        "success".equals(status) ? "confirmed" : "failed",
        str(p, "reason"));
  }

  private static String enc(String v) {
    return URLEncoder.encode(v, StandardCharsets.UTF_8);
  }

  private static String str(Map<String, Object> p, String key) {
    Object v = p.get(key);
    return v instanceof String s ? s : null;
  }
}
