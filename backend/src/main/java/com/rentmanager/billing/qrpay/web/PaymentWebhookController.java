package com.rentmanager.billing.qrpay.web;

import com.rentmanager.billing.qrpay.QrProvider;
import com.rentmanager.billing.qrpay.QrProviderRegistry;
import com.rentmanager.billing.service.PaymentAppService;
import com.rentmanager.billing.service.PaymentAppService.WebhookResult;
import com.rentmanager.kernel.settings.SettingsService;
import com.rentmanager.platform.web.ApiException;
import com.rentmanager.platform.web.RateLimiter;
import jakarta.servlet.http.HttpServletRequest;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Set;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * M13 / §9.6 gateway webhook (signed with the shared secret). Provider payloads
 * ({@code provider} field present) are normalized through the M13 adapter;
 * generic payloads take the §9.6 shape directly. Duplicate notifications are
 * ignored idempotently: replays return {@code 200 {ignored:true}} and never
 * double-post or re-issue receipts. Mirrors {@code
 * src/app/api/webhooks/payments/route.ts}.
 */
@RestController
@RequestMapping("/api/webhooks/payments")
public class PaymentWebhookController {

  private static final Set<String> VALID_STATUS = Set.of("confirmed", "failed");

  private final PaymentAppService paymentService;
  private final QrProviderRegistry providers;
  private final SettingsService settings;
  private final RateLimiter rateLimiter;

  public PaymentWebhookController(PaymentAppService paymentService, QrProviderRegistry providers,
      SettingsService settings, RateLimiter rateLimiter) {
    this.paymentService = paymentService;
    this.providers = providers;
    this.settings = settings;
    this.rateLimiter = rateLimiter;
  }

  @PostMapping
  public Map<String, Object> receive(@RequestBody(required = false) Map<String, Object> raw,
      HttpServletRequest req) {
    // M27: webhook rate limiting.
    if (!rateLimiter.allow("webhook-pay:" + clientIp(req), 60, 60_000)) {
      throw new ApiException(429, "RATE_LIMITED", "Too many requests");
    }
    // M28: DB-sealed secret overrides the env default.
    String secret = req.getHeader("x-webhook-secret");
    String expected = settings.providerSecret("paymentCredentials");
    if (secret == null || expected == null || !secret.equals(expected)) {
      throw new ApiException(401, "UNAUTHENTICATED", "Invalid webhook secret");
    }
    if (raw == null) {
      throw new ApiException(400, "VALIDATION_ERROR", "Request body must be valid JSON");
    }

    String paymentId;
    String gatewayRef;
    String idempotencyKey;
    String status;
    String reason;

    if (raw.containsKey("provider")) {
      QrProvider.NormalizedWebhook n = providers.resolve(str(raw, "provider")).parseWebhook(raw);
      if (n == null) {
        throw new ApiException(400, "INVALID_PAYLOAD", "Unrecognized provider webhook payload");
      }
      paymentId = n.paymentId();
      gatewayRef = n.gatewayRef();
      idempotencyKey = n.idempotencyKey();
      status = n.status();
      reason = n.reason();
      if (blank(gatewayRef) && blank(idempotencyKey)) {
        throw new ApiException(400, "INVALID_PAYLOAD",
            "Provider webhook must reference a payment (ref/idempotencyKey)");
      }
    } else {
      paymentId = str(raw, "paymentId");
      gatewayRef = str(raw, "gatewayRef");
      idempotencyKey = str(raw, "idempotencyKey");
      status = str(raw, "status");
      reason = str(raw, "reason");
      if (status == null || !VALID_STATUS.contains(status)) {
        throw new ApiException(400, "VALIDATION_ERROR", "status: must be confirmed | failed");
      }
      if (blank(paymentId) && blank(gatewayRef) && blank(idempotencyKey)) {
        throw new ApiException(400, "VALIDATION_ERROR",
            "One of paymentId | gatewayRef | idempotencyKey is required");
      }
      if (reason != null && reason.length() > 500) {
        throw new ApiException(400, "VALIDATION_ERROR", "reason: must be at most 500 characters");
      }
    }

    WebhookResult result =
        paymentService.handleWebhook(paymentId, gatewayRef, idempotencyKey, status, reason);
    Map<String, Object> out = new LinkedHashMap<>();
    out.put("received", true);
    out.put("ignored", result.ignored());
    out.put("paymentStatus", result.paymentStatus());
    out.put("receiptCode", result.receiptCode() == null ? "" : result.receiptCode());
    return out;
  }

  private static boolean blank(String s) {
    return s == null || s.isEmpty();
  }

  private static String str(Map<String, Object> p, String key) {
    Object v = p.get(key);
    return v instanceof String s ? s : null;
  }

  private static String clientIp(HttpServletRequest req) {
    String fwd = req.getHeader("X-Forwarded-For");
    if (fwd != null && !fwd.isBlank()) return fwd.split(",")[0].trim();
    String real = req.getHeader("X-Real-IP");
    return real != null ? real : (req.getRemoteAddr() == null ? "unknown" : req.getRemoteAddr());
  }
}
