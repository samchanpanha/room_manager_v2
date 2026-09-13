package com.rentmanager.billing.web;

import com.rentmanager.billing.dto.CreateInvoiceRequest;
import com.rentmanager.billing.dto.InvoiceDto;
import com.rentmanager.billing.service.InvoiceService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/invoices")
public class InvoiceController {

    private final InvoiceService invoiceService;

    public InvoiceController(InvoiceService invoiceService) {
        this.invoiceService = invoiceService;
    }

    @GetMapping
    public ResponseEntity<List<InvoiceDto>> getInvoicesByProperty(@RequestParam String propertyId) {
        return ResponseEntity.ok(invoiceService.getInvoicesByProperty(propertyId));
    }

    @GetMapping("/{id}")
    public ResponseEntity<InvoiceDto> getInvoiceById(@PathVariable String id) {
        return ResponseEntity.ok(invoiceService.getInvoiceById(id));
    }

    @PostMapping
    public ResponseEntity<InvoiceDto> createInvoice(
            @RequestHeader(value = "X-Rm-User-Id", required = false) String userId,
            @Valid @RequestBody CreateInvoiceRequest request) {
        InvoiceDto created = invoiceService.createInvoice(request, userId);
        return ResponseEntity.status(HttpStatus.CREATED).body(created);
    }
}
