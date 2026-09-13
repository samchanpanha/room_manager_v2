package com.rentmanager.platform.web;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/settings")
public class SettingsController {

    @GetMapping
    public ResponseEntity<Map<String, Object>> getSettings(
            @RequestHeader(value = "X-Rm-Tenant-Id", defaultValue = "DEFAULT") String tenantId) {
        return ResponseEntity.ok(Map.of(
            "tenantId", tenantId,
            "theme", "light",
            "currency", "USD",
            "timezone", "UTC",
            "language", "en"
        ));
    }
}
