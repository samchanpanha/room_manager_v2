package com.rentmanager.platform.web;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/owners")
public class OwnerController {

    private final JdbcTemplate jdbc;

    public OwnerController(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    @GetMapping
    public ResponseEntity<List<Map<String, Object>>> getOwners(
            @RequestHeader(value = "X-Rm-Tenant-Id", defaultValue = "DEFAULT") String tenantId) {
        String sql = """
            SELECT o.id, p.name, p.email, p.phone, o.status, o."companyName", o.notes
            FROM "OwnerProfile" o
            JOIN "Party" p ON o."partyId" = p.id
            WHERE p."tenantId" = ?
            ORDER BY o."createdAt" ASC
            """;
        List<Map<String, Object>> owners = jdbc.queryForList(sql, tenantId);
        if (!owners.isEmpty()) {
            String ids = owners.stream()
                .map(o -> "'" + o.get("id") + "'")
                .collect(Collectors.joining(","));
            String payoutSql = """
                SELECT "ownerProfileId", id, kind, "accountName", "accountNumber", "isPrimary"
                FROM "OwnerPayoutMethod"
                WHERE "ownerProfileId" IN (%s)
                """.formatted(ids);
            Map<String, List<Map<String, Object>>> payoutByOwner = jdbc.queryForList(payoutSql).stream()
                .collect(Collectors.groupingBy(p -> (String) p.get("ownerProfileId")));
            for (Map<String, Object> o : owners) {
                o.put("payoutMethods", payoutByOwner.getOrDefault(o.get("id"), List.of()));
            }
        }
        return ResponseEntity.ok(owners);
    }

    @PostMapping
    public ResponseEntity<Map<String, Object>> createOwner(
            @RequestHeader(value = "X-Rm-Tenant-Id", defaultValue = "DEFAULT") String tenantId,
            @RequestBody Map<String, Object> body) {
        String partyId = "party_" + UUID.randomUUID().toString().replace("-", "").substring(0, 16);
        String ownerId = "own_" + UUID.randomUUID().toString().replace("-", "").substring(0, 16);

        String name = (String) body.get("name");
        String email = (String) body.get("email");
        String phone = (String) body.get("phone");
        String companyName = (String) body.get("companyName");

        jdbc.update("INSERT INTO \"Party\" (id, \"tenantId\", type, name, email, phone) VALUES (?, ?, ?, ?, ?, ?)",
            partyId, tenantId, companyName != null ? "COMPANY" : "PERSON", name, email, phone);

        jdbc.update("INSERT INTO \"OwnerProfile\" (id, \"partyId\", \"companyName\") VALUES (?, ?, ?)",
            ownerId, partyId, companyName);

        return ResponseEntity.status(HttpStatus.CREATED).body(Map.of("id", ownerId, "name", name));
    }
}
