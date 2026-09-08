package com.rentmanager.billing.qrpay.web;

import com.rentmanager.billing.domain.Invoice;
import com.rentmanager.billing.domain.InvoiceRepository;
import com.rentmanager.billing.qrpay.QrPaymentService;
import com.rentmanager.billing.qrpay.QrProviderRegistry;
import com.rentmanager.kernel.tenant.TenantContext;
import com.rentmanager.members.MemberAccessApi;
import com.rentmanager.platform.security.AuthPrincipal;
import com.rentmanager.platform.security.CurrentUser;
import com.rentmanager.platform.security.Rbdc;
import com.rentmanager.platform.web.ApiException;
import java.util.LinkedHashMap;
import java.util.Map;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * M13 dynamic QR for one invoice — mirrors {@code POST
 * /api/invoices/{id}/qr}. Members may pay their own invoice (owns the invoice's
 * member profile); staff need {@code M13:create} in the invoice's property scope.
 */
@RestController
@RequestMapping("/api/invoices")
public class InvoiceQrController {

  private final InvoiceRepository invoices;
  private final MemberAccessApi membersApi;
  private final QrPaymentService qrPayments;
  private final QrProviderRegistry providers;
  private final CurrentUser currentUser;

  public InvoiceQrController(InvoiceRepository invoices, MemberAccessApi membersApi,
      QrPaymentService qrPayments, QrProviderRegistry providers, CurrentUser currentUser) {
    this.invoices = invoices;
    this.membersApi = membersApi;
    this.qrPayments = qrPayments;
    this.providers = providers;
    this.currentUser = currentUser;
  }

  public record QrRequest(String provider) {}

  @PostMapping("/{id}/qr")
  public Map<String, Object> createQr(@PathVariable String id,
      @RequestBody(required = false) QrRequest body) {
    AuthPrincipal user = currentUser.require();
    Invoice invoice = invoices.findByIdAndTenantId(id, TenantContext.get())
        .orElseThrow(() -> ApiException.notFound("Invoice not found"));

    String ownMemberId = membersApi.memberIdForParty(user.partyId());
    boolean isOwnInvoice = ownMemberId != null && ownMemberId.equals(invoice.getMemberProfileId());
    if (!isOwnInvoice
        && !Rbdc.can(user, "create", "M13", Rbdc.ResourceRef.property(invoice.getPropertyId()))) {
      throw new ApiException(403, "FORBIDDEN", "Missing permission M13:create for this invoice");
    }

    String provider = body == null ? null : body.provider();
    if (provider != null && !providers.isProviderName(provider)) {
      throw new ApiException(400, "INVALID_PROVIDER", "Unknown QR provider");
    }

    QrPaymentService.InvoiceQr r = qrPayments.createInvoiceQr(id, user.id(), user.name(), provider);
    return toMap(r);
  }

  static Map<String, Object> toMap(QrPaymentService.InvoiceQr r) {
    Map<String, Object> out = new LinkedHashMap<>();
    out.put("paymentId", r.paymentId());
    out.put("paymentCode", r.paymentCode());
    out.put("amountMinor", r.amountMinor());
    out.put("provider", r.provider());
    out.put("qrString", r.qrString());
    out.put("imageDataUrl", r.imageDataUrl());
    out.put("expiresAt", r.expiresAt());
    out.put("reused", r.reused());
    return out;
  }
}
