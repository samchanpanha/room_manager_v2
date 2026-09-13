package com.rentmanager.staff.web;

import org.springframework.http.ResponseEntity;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/payout-methods")
public class PayoutMethodController {

    private final JdbcTemplate jdbc;

    public PayoutMethodController(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    @GetMapping
    public ResponseEntity<List<Map<String, Object>>> getPayoutMethods(@RequestParam(required = false) String ownerId) {
        String sql = "SELECT id, \"ownerPartyId\", type, name, status FROM \"OwnerPayoutMethod\"";
        if (ownerId != null && !ownerId.isBlank()) {
            sql += " WHERE \"ownerPartyId\" = ?";
            return ResponseEntity.ok(jdbc.queryForList(sql, ownerId));
        }
        return ResponseEntity.ok(jdbc.queryForList(sql));
    }
}
