package com.rentmanager.billing.web;

import com.rentmanager.billing.dto.CreateInvoiceRequest;
import com.rentmanager.billing.dto.CreditNoteRequest;
import com.rentmanager.billing.dto.InvoiceDetail;
import com.rentmanager.billing.dto.InvoiceSummary;
import com.rentmanager.billing.dto.VoidInvoiceRequest;
import com.rentmanager.billing.service.InvoiceAppService;
import com.rentmanager.billing.service.InvoiceAppService.CreditNoteResult;
import com.rentmanager.platform.security.CurrentUser;
import java.util.List;
import java.util.Map;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

/**
 * REST for M07, mirroring {@code src/app/api/invoices/*}:
 * list/create draft, get detail, and the lifecycle actions issue/void plus
 * credit-note creation.
 */
@RestController
@RequestMapping("/api/invoices")
public class InvoiceController {

  private final InvoiceAppService service;
  private final CurrentUser currentUser;

  public InvoiceController(InvoiceAppService service, CurrentUser currentUser) {
    this.service = service;
    this.currentUser = currentUser;
  }

  @GetMapping
  public List<InvoiceSummary> list(@RequestParam(required = false) String status,
      @RequestParam(required = false) String propertyId) {
    return service.list(currentUser.require(), status, propertyId);
  }

  @GetMapping("/{id}")
  public InvoiceDetail get(@PathVariable String id) {
    return service.get(currentUser.require(), id);
  }

  @PostMapping
  public ResponseEntity<InvoiceDetail> create(@RequestBody CreateInvoiceRequest body) {
    InvoiceDetail d = service.createDraft(currentUser.require(), body);
    return ResponseEntity.status(HttpStatus.CREATED).body(d);
  }

  @PostMapping("/{id}/issue")
  public Map<String, Object> issue(@PathVariable String id) {
    InvoiceDetail d = service.issue(currentUser.require(), id);
    return Map.of("issued", true, "invoice", d.invoice());
  }

  @PostMapping("/{id}/void")
  public Map<String, Object> voidInvoice(@PathVariable String id,
      @RequestBody(required = false) VoidInvoiceRequest body) {
    service.voidInvoice(currentUser.require(), id, body == null ? null : body.reason());
    return Map.of("voided", true);
  }

  @PostMapping("/{id}/credit-notes")
  public ResponseEntity<Map<String, Object>> creditNote(@PathVariable String id,
      @RequestBody CreditNoteRequest body) {
    CreditNoteResult r = service.createCreditNote(currentUser.require(), id, body);
    return ResponseEntity.status(HttpStatus.CREATED)
        .body(Map.of("code", r.code(), "invoiceStatus", r.invoiceStatus()));
  }
}
