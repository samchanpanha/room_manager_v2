package com.rentmanager.billing.web;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/rent-engine")
public class RentEngineController {

    @GetMapping("/rules")
    public ResponseEntity<Map<String, Object>> getRules(@RequestParam(required = false) String propertyId) {
        return ResponseEntity.ok(Map.of(
            "propertyId", propertyId != null ? propertyId : "ALL",
            "prorationMethod", "exact_days",
            "lateFeePolicy", "grace_5_days",
            "autoBillingDay", 1
        ));
    }
}
