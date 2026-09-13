package com.rentmanager.platform.web;

import org.springframework.http.ResponseEntity;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping({"/api/documents", "/api/files"})
public class DocumentController {

    private final JdbcTemplate jdbc;

    public DocumentController(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    @GetMapping
    public ResponseEntity<List<Map<String, Object>>> getDocuments(@RequestParam(required = false) String entityId) {
        String sql = "SELECT id, title, category, \"mimeType\", \"fileSize\", \"storageKey\", \"createdAt\" FROM \"DocumentRecord\"";
        if (entityId != null && !entityId.isBlank()) {
            sql += " WHERE \"entityId\" = ?";
            return ResponseEntity.ok(jdbc.queryForList(sql, entityId));
        }
        return ResponseEntity.ok(jdbc.queryForList(sql));
    }
}
