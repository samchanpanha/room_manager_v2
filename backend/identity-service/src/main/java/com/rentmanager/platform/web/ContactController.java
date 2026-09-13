package com.rentmanager.platform.web;

import org.springframework.http.ResponseEntity;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/contacts")
public class ContactController {

    private final JdbcTemplate jdbc;

    public ContactController(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Map<String, Object>> deleteContact(@PathVariable String id) {
        String sql = "DELETE FROM \"EmergencyContact\" WHERE id = ?";
        int rows = jdbc.update(sql, id);
        if (rows > 0) {
            return ResponseEntity.ok(Map.of("deleted", true, "id", id));
        }
        return ResponseEntity.notFound().build();
    }
}
