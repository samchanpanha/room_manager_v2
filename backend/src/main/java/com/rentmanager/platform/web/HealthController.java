package com.rentmanager.platform.web;

import java.util.Map;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

/** {@code GET /api/health} — parity with the Next {@code /api/health} route. */
@RestController
public class HealthController {

  @GetMapping("/api/health")
  public Map<String, Object> health() {
    return Map.of("status", "ok", "service", "rentmanager-backend");
  }
}
