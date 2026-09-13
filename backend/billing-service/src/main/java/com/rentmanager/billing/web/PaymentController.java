package com.rentmanager.billing.web;

import com.rentmanager.billing.dto.PaymentDto;
import com.rentmanager.billing.dto.RecordPaymentRequest;
import com.rentmanager.billing.service.PaymentService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/payments")
public class PaymentController {

    private final PaymentService paymentService;

    public PaymentController(PaymentService paymentService) {
        this.paymentService = paymentService;
    }

    @GetMapping
    public ResponseEntity<List<PaymentDto>> getPaymentsByMember(@RequestParam String memberProfileId) {
        return ResponseEntity.ok(paymentService.getPaymentsByMember(memberProfileId));
    }

    @PostMapping
    public ResponseEntity<PaymentDto> recordPayment(
            @RequestHeader(value = "X-Rm-User-Id", required = false) String userId,
            @Valid @RequestBody RecordPaymentRequest request) {
        PaymentDto created = paymentService.recordPayment(request, userId);
        return ResponseEntity.status(HttpStatus.CREATED).body(created);
    }
}
