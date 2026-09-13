package com.rentmanager.platform.web;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.web.bind.annotation.*;

import java.sql.Timestamp;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/organizations")
public class OrganizationController {

    private final JdbcTemplate jdbc;

    public OrganizationController(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    @GetMapping
    public ResponseEntity<List<Map<String, Object>>> getOrganizations(
            @RequestHeader(value = "X-Rm-Tenant-Id", defaultValue = "DEFAULT") String tenantId,
            @RequestHeader(value = "X-Rm-Roles", defaultValue = "") String roles) {
        
        boolean isSuperAdmin = roles.contains("SUPER_ADMIN") && "DEFAULT".equals(tenantId);
        String sql = "SELECT id, name, slug, status, \"createdAt\", \"updatedAt\" FROM \"Tenant\"";
        
        if (!isSuperAdmin) {
            sql += " WHERE id = ?";
            return ResponseEntity.ok(jdbc.queryForList(sql, tenantId));
        }
        return ResponseEntity.ok(jdbc.queryForList(sql));
    }

    @PostMapping
    public ResponseEntity<Map<String, Object>> createOrganization(@RequestBody Map<String, Object> body) {
        String id = "tnt_" + UUID.randomUUID().toString().replace("-", "").substring(0, 16);
        String name = (String) body.get("name");
        String slug = (String) body.get("slug");
        String email = (String) body.get("contactEmail");

        String sql = "INSERT INTO \"Tenant\" (id, name, slug, \"contactEmail\", status, \"createdAt\", \"updatedAt\") VALUES (?, ?, ?, ?, 'active', ?, ?)";
        jdbc.update(sql, id, name, slug, email, Timestamp.from(Instant.now()), Timestamp.from(Instant.now()));

        return ResponseEntity.status(HttpStatus.CREATED).body(Map.of("id", id, "name", name, "slug", slug));
    }
}
