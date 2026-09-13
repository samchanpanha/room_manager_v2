package com.rentmanager.billing.web;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/qrpay")
public class QrPayController {

    @GetMapping("/generate")
    public ResponseEntity<Map<String, Object>> generateQr(
            @RequestParam String invoiceId,
            @RequestParam int amountMinor) {
        String qrPayload = "KHQR://PAYMENT?inv=" + invoiceId + "&amt=" + amountMinor + "&ref=" + UUID.randomUUID().toString().substring(0, 8);
        return ResponseEntity.ok(Map.of(
            "invoiceId", invoiceId,
            "amountMinor", amountMinor,
            "qrString", qrPayload
        ));
    }
}
