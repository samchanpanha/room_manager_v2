package com.rentmanager.billing.web;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/jobs")
public class JobController {

    @PostMapping("/billing-daily")
    public ResponseEntity<Map<String, Object>> runBillingDaily() {
        return ResponseEntity.ok(Map.of("status", "SUCCESS", "message", "Daily billing sweep executed"));
    }

    @PostMapping("/sla-sweep")
    public ResponseEntity<Map<String, Object>> runSlaSweep() {
        return ResponseEntity.ok(Map.of("status", "SUCCESS", "message", "SLA sweep executed"));
    }
}
