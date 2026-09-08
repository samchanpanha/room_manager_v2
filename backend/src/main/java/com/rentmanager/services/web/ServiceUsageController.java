package com.rentmanager.services.web;

import com.rentmanager.platform.security.AuthPrincipal;
import com.rentmanager.platform.security.CurrentUser;
import com.rentmanager.services.dto.RecordUsageRequest;
import com.rentmanager.services.service.ServiceAppService;
import jakarta.validation.Valid;
import java.util.Map;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

/** REST for M12 per-use entries, mirroring {@code src/app/api/services/usages/route.ts}. */
@RestController
@RequestMapping("/api/services/usages")
public class ServiceUsageController {

  private final ServiceAppService service;
  private final CurrentUser currentUser;

  public ServiceUsageController(ServiceAppService service, CurrentUser currentUser) {
    this.service = service;
    this.currentUser = currentUser;
  }

  @GetMapping
  public Map<String, Object> list() {
    AuthPrincipal user = currentUser.require();
    return Map.of("usages", service.listUsages(user));
  }

  @PostMapping
  public ResponseEntity<ServiceAppService.UsageResult> record(
      @Valid @RequestBody RecordUsageRequest body) {
    AuthPrincipal user = currentUser.require();
    return ResponseEntity.status(HttpStatus.CREATED).body(service.recordUsage(user, body));
  }
}
