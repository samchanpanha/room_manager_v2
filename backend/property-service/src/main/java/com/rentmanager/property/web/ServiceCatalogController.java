package com.rentmanager.property.web;

import org.springframework.http.ResponseEntity;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/services")
public class ServiceCatalogController {

    private final JdbcTemplate jdbc;

    public ServiceCatalogController(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    @GetMapping
    public ResponseEntity<List<Map<String, Object>>> getServices() {
        String sql = "SELECT id, name, category, \"priceMinor\", unit, \"isActive\" FROM \"ServiceCatalog\" ORDER BY name ASC";
        List<Map<String, Object>> services = jdbc.queryForList(sql);
        return ResponseEntity.ok(services);
    }
}
