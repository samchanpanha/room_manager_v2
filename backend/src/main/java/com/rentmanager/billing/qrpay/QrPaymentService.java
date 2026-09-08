package com.rentmanager.billing.qrpay;

import com.rentmanager.billing.domain.Invoice;
import com.rentmanager.billing.domain.InvoiceRepository;
import com.rentmanager.billing.domain.Payment;
import com.rentmanager.billing.domain.PaymentRepository;
import com.rentmanager.billing.service.PaymentAllocator.Allocation;
import com.rentmanager.billing.service.PaymentAppService;
import com.rentmanager.kernel.settings.SettingsService;
import com.rentmanager.kernel.tenant.TenantContext;
import com.rentmanager.members.MemberAccessApi;
import com.rentmanager.platform.web.ApiException;
import java.security.SecureRandom;
import java.time.Instant;
import java.util.List;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * M13 QR payment orchestration — Java port of {@code src/lib/qrpay/service.ts}.
 * A "Pay by QR" intent is just an M09 pending payment with {@code method=qr}, an
 * explicit allocation to that one invoice and a deterministic idempotency key,
 * so repeat clicks reuse the SAME pending payment (and its gateway ref): the QR
 * stays stable and confirmation stays exactly-once (§M13 acceptance).
 */
@Service
public class QrPaymentService {

  private final InvoiceRepository invoices;
  private final PaymentRepository payments;
  private final MemberAccessApi membersApi;
  private final PaymentAppService paymentService;
  private final QrProviderRegistry providers;
  private final SettingsService settings;
  private final SecureRandom random = new SecureRandom();

  public QrPaymentService(InvoiceRepository invoices, PaymentRepository payments,
      MemberAccessApi membersApi, PaymentAppService paymentService,
      QrProviderRegistry providers, SettingsService settings) {
    this.invoices = invoices;
    this.payments = payments;
    this.membersApi = membersApi;
    this.paymentService = paymentService;
    this.providers = providers;
    this.settings = settings;
  }

  /** Dynamic QR for one invoice (paymentId + code + scan payload + PNG + expiry). */
  public record InvoiceQr(String paymentId, String paymentCode, int amountMinor, String provider,
      String qrString, String imageDataUrl, Instant expiresAt, boolean reused) {}

  /** One open invoice line shown on the public /pay page. */
  public record DueInvoice(String id, String code, String status, Instant dueDate,
      int totalMinor, int amountDueMinor, Instant periodStart, Instant periodEnd) {}

  /** Public /pay page data for a member token: name + open balances only. */
  public record MemberDues(String memberId, String memberName, List<DueInvoice> invoices,
      int totalDueMinor) {}

  /**
   * Build (or reuse) the pending QR payment for an invoice and render its QR.
   * Authorization is enforced by the caller (the controller). {@code actorId} is
   * null for the poster/gateway flow.
   */
  @Transactional
  public InvoiceQr createInvoiceQr(String invoiceId, String actorId, String actorName,
      String providerName) {
    String tenantId = TenantContext.get();
    Invoice invoice = invoices.findByIdAndTenantId(invoiceId, tenantId)
        .orElseThrow(() -> ApiException.notFound("Invoice not found"));
    if ("void".equals(invoice.getStatus())) {
      throw new ApiException(422, "INVOICE_VOID", "This invoice was voided");
    }
    int due = invoice.getAmountDueMinor();
    if (due <= 0) {
      throw new ApiException(422, "NOTHING_DUE", "This invoice has no outstanding balance");
    }

    // Deterministic key per invoice + due snapshot; skip past non-pending
    // attempts so a failed gateway try regenerates a fresh intent.
    boolean reused = false;
    String idempotencyKey = "QR:" + invoice.getId() + ":" + due;
    for (int attempt = 0; attempt < 5; attempt++) {
      Payment existing = payments.findByIdempotencyKeyAndTenantId(idempotencyKey, tenantId).orElse(null);
      if (existing == null) break;
      if ("pending".equals(existing.getStatus())) {
        reused = true;
        break;
      }
      idempotencyKey = "QR:" + invoice.getId() + ":" + due + ":r" + (attempt + 1);
    }

    String gatewayRef = "QRPAY-" + randomHex(5).toUpperCase();
    var created = paymentService.recordGatewayPayment(
        invoice.getMemberProfileId(), "qr", due,
        List.of(new Allocation(invoice.getId(), due)),
        idempotencyKey, gatewayRef, actorId, actorName);

    Payment payment = payments.findByIdAndTenantId(created.paymentId(), tenantId)
        .orElseThrow(() -> ApiException.notFound("Payment not found"));
    if (!"pending".equals(payment.getStatus())) {
      throw new ApiException(422, "ALREADY_SETTLED",
          "This QR payment is already " + payment.getStatus());
    }

    String orgName = settings.org().name();
    QrProvider provider = providers.resolve(providerName);
    QrProvider.QrCharge charge = provider.generateQR(new QrProvider.QrChargeInput(
        due,
        payment.getGatewayRef() != null ? payment.getGatewayRef() : payment.getCode(),
        orgName != null ? orgName : "RentManager",
        null));

    return new InvoiceQr(payment.getId(), payment.getCode(), due, provider.name(),
        charge.qrString(), charge.imageDataUrl(), charge.expiresAt(), reused);
  }

  /** Public /pay page data for a member token (name + open balances only). */
  @Transactional(readOnly = true)
  public MemberDues memberDuesForToken(String memberProfileId) {
    String tenantId = TenantContext.get();
    MemberAccessApi.MemberIdentity member = membersApi.identityOrNull(memberProfileId);
    if (member == null) return null;
    String name = member.name();

    List<Invoice> open = invoices.findOpenForMember(tenantId, memberProfileId);
    List<DueInvoice> lines = open.stream()
        .map(i -> new DueInvoice(i.getId(), i.getCode(), i.getStatus(), i.getDueDate(),
            i.getTotalMinor(), i.getAmountDueMinor(), i.getPeriodStart(), i.getPeriodEnd()))
        .toList();
    int total = lines.stream().mapToInt(DueInvoice::amountDueMinor).sum();
    return new MemberDues(member.id(), name, lines, total);
  }

  private String randomHex(int bytes) {
    byte[] b = new byte[bytes];
    random.nextBytes(b);
    StringBuilder sb = new StringBuilder(bytes * 2);
    for (byte x : b) sb.append(String.format("%02x", x));
    return sb.toString();
  }
}
