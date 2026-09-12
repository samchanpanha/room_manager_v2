package com.rentmanager.platform.web;

import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.Map;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * {@code GET /api/health} — parity with the Next {@code /api/health} route
 * ({@code {status:"ok", time}}), confirming the DB is reachable via
 * {@code SELECT 1}.
 */
@RestController
public class HealthController {

  private final JdbcTemplate jdbc;

  public HealthController(JdbcTemplate jdbc) {
    this.jdbc = jdbc;
  }

  @GetMapping("/api/health")
  public Map<String, Object> health() {
    jdbc.queryForObject("SELECT 1", Integer.class);
    Map<String, Object> body = new LinkedHashMap<>();
    body.put("status", "ok");
    body.put("time", Instant.now().toString()); // ISO-8601 UTC, like new Date().toISOString()
    return body;
  }
}