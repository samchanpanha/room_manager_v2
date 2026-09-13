package com.rentmanager.platform.web;

import org.springframework.http.ResponseEntity;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping({"/api/audit", "/api/audit-logs"})
public class AuditLogController {

    private final JdbcTemplate jdbc;

    public AuditLogController(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    @GetMapping
    public ResponseEntity<List<Map<String, Object>>> getAuditLogs(
            @RequestParam(required = false) String module,
            @RequestParam(defaultValue = "50") int take) {
        String sql = "SELECT id, \"actorId\", \"actorName\", module, action, \"entityType\", \"entityId\", summary, \"createdAt\" FROM \"AuditLog\"";
        if (module != null && !module.isBlank()) {
            sql += " WHERE module = ?";
            sql += " ORDER BY \"createdAt\" DESC LIMIT " + Math.min(take, 200);
            return ResponseEntity.ok(jdbc.queryForList(sql, module));
        }
        sql += " ORDER BY \"createdAt\" DESC LIMIT " + Math.min(take, 200);
        return ResponseEntity.ok(jdbc.queryForList(sql));
    }
}
