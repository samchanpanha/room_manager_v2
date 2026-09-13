package com.rentmanager.notification.web;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/portal")
public class TenantPortalController {

    @GetMapping("/notices")
    public ResponseEntity<List<Map<String, Object>>> getNotices() {
        return ResponseEntity.ok(List.of(
            Map.of("id", "notice_1", "title", "Scheduled Water Maintenance", "date", "2026-09-15", "content", "Water maintenance will be conducted from 2 PM to 4 PM.")
        ));
    }
}
