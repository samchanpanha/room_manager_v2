package com.rentmanager.property.web;

import org.springframework.http.ResponseEntity;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/tariffs")
public class TariffController {

    private final JdbcTemplate jdbc;

    public TariffController(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    @GetMapping
    public ResponseEntity<List<Map<String, Object>>> getTariffs() {
        String sql = "SELECT id, \"utilityType\", name, \"propertyId\", \"unitRateMinor\", \"isActive\" FROM \"Tariff\" ORDER BY \"utilityType\" ASC";
        List<Map<String, Object>> tariffs = jdbc.queryForList(sql);
        return ResponseEntity.ok(tariffs);
    }
}
