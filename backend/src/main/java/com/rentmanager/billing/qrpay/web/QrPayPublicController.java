package com.rentmanager.billing.qrpay.web;

import com.rentmanager.billing.domain.Invoice;
import com.rentmanager.billing.domain.InvoiceRepository;
import com.rentmanager.billing.domain.Payment;
import com.rentmanager.billing.domain.PaymentRepository;
import com.rentmanager.billing.qrpay.MemberQrTokens;
import com.rentmanager.billing.qrpay.QrPaymentService;
import com.rentmanager.billing.qrpay.QrProviderRegistry;
import com.rentmanager.billing.service.PaymentAppService;
import com.rentmanager.kernel.tenant.TenantContext;
import com.rentmanager.platform.web.ApiException;
import com.rentmanager.platform.web.RateLimiter;
import jakarta.servlet.http.HttpServletRequest;
import java.util.LinkedHashMap;
import java.util.Map;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * M13 public poster/QR flow (§M13 "pay-without-login via member QR scan"). A
 * signed member token (issued by {@code GET /api/members/{id}/qr}) resolves to
 * the member server-side; nothing beyond name + open invoice totals is exposed.
 * All endpoints are rate-limited. Mirrors {@code src/app/api/qrpay/*}.
 */
@RestController
@RequestMapping("/api/qrpay")
public class QrPayPublicController {

  private final MemberQrTokens tokens;
  private final QrPaymentService qrPayments;
  private final QrProviderRegistry providers;
  private final PaymentRepository payments;
  private final InvoiceRepository invoices;
  private final RateLimiter rateLimiter;

  public QrPayPublicController(MemberQrTokens tokens, QrPaymentService qrPayments,
      QrProviderRegistry providers, PaymentRepository payments, InvoiceRepository invoices,
      RateLimiter rateLimiter) {
    this.tokens = tokens;
    this.qrPayments = qrPayments;
    this.providers = providers;
    this.payments = payments;
    this.invoices = invoices;
    this.rateLimiter = rateLimiter;
  }

  public record DuesRequest(String m) {}
  public record PayRequest(String m, String invoiceId, String provider) {}
  public record StatusRequest(String m, String paymentId) {}

  /** Resolve a signed member token into open balances (name + totals only). */
  @PostMapping("/dues")
  public Map<String, Object> dues(@RequestBody DuesRequest body, HttpServletRequest req) {
    limit("qrpay-dues", req, 30);
    String memberId = requireToken(body == null ? null : body.m());
    QrPaymentService.MemberDues dues = qrPayments.memberDuesForToken(memberId);
    if (dues == null) throw ApiException.notFound("Member not found");

    Map<String, Object> out = new LinkedHashMap<>();
    out.put("member", Map.of("id", dues.memberId(), "name", dues.memberName() == null ? "" : dues.memberName()));
    out.put("invoices", dues.invoices().stream().map(i -> {
      Map<String, Object> m = new LinkedHashMap<>();
      m.put("id", i.id());
      m.put("code", i.code());
      m.put("status", i.status());
      m.put("dueDate", i.dueDate());
      m.put("totalMinor", i.totalMinor());
      m.put("amountDueMinor", i.amountDueMinor());
      m.put("periodStart", i.periodStart());
      m.put("periodEnd", i.periodEnd());
      return m;
    }).toList());
    out.put("totalDueMinor", dues.totalDueMinor());
    return out;
  }

  /**
   * Start a QR payment for one of the token member's open invoices. The amount
   * is ALWAYS the invoice's outstanding due — no free-form amounts without login.
   */
  @PostMapping("/pay")
  public Map<String, Object> pay(@RequestBody PayRequest body, HttpServletRequest req) {
    limit("qrpay-pay", req, 10);
    if (body == null || body.invoiceId() == null || body.invoiceId().isBlank()) {
      throw ApiException.validation("invoiceId is required");
    }
    String memberId = requireToken(body.m());
    // Ownership: the invoice must belong to the token's member (mirrors the Next
    // handler's direct invoice lookup before starting the QR).
    Invoice invoice = invoices.findByIdAndTenantId(body.invoiceId(), TenantContext.get())
        .orElse(null);
    if (invoice == null || !memberId.equals(invoice.getMemberProfileId())) {
      throw ApiException.notFound("Invoice not found for this member");
    }

    String provider = body.provider();
    if (provider != null && !providers.isProviderName(provider)) {
      throw new ApiException(400, "INVALID_PROVIDER", "Unknown QR provider");
    }
    QrPaymentService.InvoiceQr r = qrPayments.createInvoiceQr(
        body.invoiceId(), PaymentAppService.GATEWAY_ACTOR_ID, "payment-gateway", provider);
    return InvoiceQrController.toMap(r);
  }

  /** Polling fallback (§M13): minimal status for a token-owned QR payment. */
  @PostMapping("/status")
  public Map<String, Object> status(@RequestBody StatusRequest body, HttpServletRequest req) {
    limit("qrpay-status", req, 120);
    if (body == null || body.paymentId() == null || body.paymentId().isBlank()) {
      throw ApiException.validation("paymentId is required");
    }
    String memberId = requireToken(body.m());
    Payment payment = payments.findByIdAndTenantId(body.paymentId(), TenantContext.get())
        .orElse(null);
    if (payment == null || !memberId.equals(payment.getMemberProfileId())) {
      throw ApiException.notFound("Payment not found");
    }
    return Map.of("status", payment.getStatus(), "code", payment.getCode());
  }

  private String requireToken(String token) {
    if (token == null || token.length() < 10) {
      throw new ApiException(401, "INVALID_TOKEN", "This QR is not valid");
    }
    String memberId = tokens.verifyMemberToken(token);
    if (memberId == null) throw new ApiException(401, "INVALID_TOKEN", "This QR is not valid");
    return memberId;
  }

  private void limit(String prefix, HttpServletRequest req, int perMinute) {
    if (!rateLimiter.allow(prefix + ":" + clientIp(req), perMinute, 60_000)) {
      throw new ApiException(429, "RATE_LIMITED", "Too many requests — try again shortly");
    }
  }

  static String clientIp(HttpServletRequest req) {
    String fwd = req.getHeader("X-Forwarded-For");
    if (fwd != null && !fwd.isBlank()) return fwd.split(",")[0].trim();
    String real = req.getHeader("X-Real-IP");
    return real != null ? real : (req.getRemoteAddr() == null ? "unknown" : req.getRemoteAddr());
  }
}
