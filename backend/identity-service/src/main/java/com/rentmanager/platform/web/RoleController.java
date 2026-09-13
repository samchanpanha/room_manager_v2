package com.rentmanager.platform.web;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/roles")
public class RoleController {

    private final JdbcTemplate jdbc;

    public RoleController(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    @GetMapping
    public ResponseEntity<List<Map<String, Object>>> getRoles() {
        String sql = "SELECT id, key, name, description, \"isSystem\", \"isProtected\" FROM \"Role\" ORDER BY name ASC";
        return ResponseEntity.ok(jdbc.queryForList(sql));
    }

    @PostMapping
    public ResponseEntity<Map<String, Object>> createRole(@RequestBody Map<String, Object> body) {
        String id = "role_" + UUID.randomUUID().toString().replace("-", "").substring(0, 16);
        String key = (String) body.get("key");
        String name = (String) body.get("name");
        String description = (String) body.get("description");

        String sql = "INSERT INTO \"Role\" (id, key, name, description, \"isSystem\", \"isProtected\") VALUES (?, ?, ?, ?, false, false)";
        jdbc.update(sql, id, key, name, description);

        return ResponseEntity.status(HttpStatus.CREATED).body(Map.of("id", id, "key", key, "name", name));
    }
}
