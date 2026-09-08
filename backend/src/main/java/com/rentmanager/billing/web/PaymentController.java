package com.rentmanager.billing.web;

import com.rentmanager.billing.dto.CreatePaymentRequest;
import com.rentmanager.billing.dto.CreatePaymentResult;
import com.rentmanager.billing.dto.PaymentDetail;
import com.rentmanager.billing.dto.PaymentSummary;
import com.rentmanager.billing.dto.ReasonRequest;
import com.rentmanager.billing.service.PaymentAppService;
import com.rentmanager.billing.service.PaymentAppService.ConfirmResult;
import com.rentmanager.platform.security.CurrentUser;
import java.util.List;
import java.util.Map;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

/**
 * REST for M09, mirroring {@code src/app/api/payments/*}:
 * list/record, get detail, and the lifecycle actions confirm/fail/refund.
 */
@RestController
@RequestMapping("/api/payments")
public class PaymentController {

  private final PaymentAppService service;
  private final CurrentUser currentUser;

  public PaymentController(PaymentAppService service, CurrentUser currentUser) {
    this.service = service;
    this.currentUser = currentUser;
  }

  @GetMapping
  public List<PaymentSummary> list(@RequestParam(required = false) String status,
      @RequestParam(required = false) String method) {
    return service.list(currentUser.require(), status, method);
  }

  @GetMapping("/{id}")
  public PaymentDetail get(@PathVariable String id) {
    return service.get(currentUser.require(), id);
  }

  @PostMapping
  public ResponseEntity<CreatePaymentResult> create(@RequestBody CreatePaymentRequest body) {
    CreatePaymentResult r = service.create(currentUser.require(), body);
    return ResponseEntity.status(HttpStatus.CREATED).body(r);
  }

  @PostMapping("/{id}/confirm")
  public Map<String, Object> confirm(@PathVariable String id) {
    ConfirmResult r = service.confirm(currentUser.require(), id);
    return Map.of("ignored", r.ignored(), "receiptCode",
        r.receiptCode() == null ? "" : r.receiptCode(), "paymentStatus", r.paymentStatus());
  }

  @PostMapping("/{id}/fail")
  public Map<String, Object> fail(@PathVariable String id, @RequestBody ReasonRequest body) {
    ConfirmResult r = service.fail(currentUser.require(), id, body == null ? null : body.reason());
    return Map.of("paymentStatus", r.paymentStatus());
  }

  @PostMapping("/{id}/refund")
  public Map<String, Object> refund(@PathVariable String id, @RequestBody ReasonRequest body) {
    ConfirmResult r = service.refund(currentUser.require(), id, body == null ? null : body.reason());
    return Map.of("paymentStatus", r.paymentStatus(),
        "receiptCode", r.receiptCode() == null ? "" : r.receiptCode());
  }
}
