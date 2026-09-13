package com.rentmanager.staff.web;

import org.springframework.http.ResponseEntity;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/owner-contracts")
public class OwnerContractController {

    private final JdbcTemplate jdbc;

    public OwnerContractController(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    @GetMapping
    public ResponseEntity<List<Map<String, Object>>> getOwnerContracts(@RequestParam(required = false) String ownerId) {
        String sql = "SELECT id, code, \"ownerPartyId\", \"propertyId\", status FROM \"OwnerContract\"";
        if (ownerId != null && !ownerId.isBlank()) {
            sql += " WHERE \"ownerPartyId\" = ?";
            return ResponseEntity.ok(jdbc.queryForList(sql, ownerId));
        }
        return ResponseEntity.ok(jdbc.queryForList(sql));
    }
}
