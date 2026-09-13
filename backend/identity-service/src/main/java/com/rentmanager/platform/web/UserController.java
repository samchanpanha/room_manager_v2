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
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/users")
public class UserController {

    private final JdbcTemplate jdbc;

    public UserController(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    @GetMapping
    public ResponseEntity<List<Map<String, Object>>> getUsers(
            @RequestHeader(value = "X-Rm-Tenant-Id", defaultValue = "DEFAULT") String tenantId) {
        String sql = "SELECT id, name, email, status, \"mustChangePassword\", \"createdAt\" FROM \"User\" WHERE \"tenantId\" = ?";
        List<Map<String, Object>> users = jdbc.queryForList(sql, tenantId);

        if (!users.isEmpty()) {
            String ids = users.stream()
                .map(u -> "'" + u.get("id") + "'")
                .collect(Collectors.joining(","));
            String rolesSql = """
                SELECT ur."userId", r.id AS roleId, r.key, r.name
                FROM "UserRole" ur
                JOIN "Role" r ON ur."roleId" = r.id
                WHERE ur."userId" IN (%s)
                """.formatted(ids);
            Map<String, List<Map<String, Object>>> rolesByUser = jdbc.queryForList(rolesSql).stream()
                .collect(Collectors.groupingBy(r -> (String) r.get("userId")));
            for (Map<String, Object> u : users) {
                List<Map<String, Object>> assigned = rolesByUser.getOrDefault(u.get("id"), List.of());
                u.put("roles", assigned.stream()
                    .map(r -> Map.of("role", Map.of(
                        "id", r.get("roleId"),
                        "key", r.get("key"),
                        "name", r.get("name"))))
                    .toList());
            }
        }
        return ResponseEntity.ok(users);
    }

    @PostMapping
    public ResponseEntity<Map<String, Object>> createUser(
            @RequestHeader(value = "X-Rm-Tenant-Id", defaultValue = "DEFAULT") String tenantId,
            @RequestBody Map<String, Object> body) {
        String id = "usr_" + UUID.randomUUID().toString().replace("-", "").substring(0, 16);
        String name = (String) body.get("name");
        String email = (String) body.get("email");

        String sql = "INSERT INTO \"User\" (id, \"tenantId\", name, email, \"passwordHash\", \"mustChangePassword\", \"totpEnabled\", \"createdAt\", \"updatedAt\") VALUES (?, ?, ?, ?, 'hash', true, false, ?, ?)";
        jdbc.update(sql, id, tenantId, name, email, Timestamp.from(Instant.now()), Timestamp.from(Instant.now()));

        return ResponseEntity.status(HttpStatus.CREATED).body(Map.of("id", id, "email", email, "name", name));
    }
}
