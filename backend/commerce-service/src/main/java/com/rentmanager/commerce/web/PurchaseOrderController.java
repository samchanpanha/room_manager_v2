package com.rentmanager.commerce.web;

import org.springframework.http.ResponseEntity;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/po")
public class PurchaseOrderController {

    private final JdbcTemplate jdbc;

    public PurchaseOrderController(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    @GetMapping
    public ResponseEntity<List<Map<String, Object>>> getPurchaseOrders(@RequestParam(required = false) String propertyId) {
        String sql = "SELECT id, code, \"propertyId\", status, \"totalMinor\" FROM \"PurchaseOrder\"";
        if (propertyId != null && !propertyId.isBlank()) {
            sql += " WHERE \"propertyId\" = ?";
            return ResponseEntity.ok(jdbc.queryForList(sql, propertyId));
        }
        return ResponseEntity.ok(jdbc.queryForList(sql));
    }
}
