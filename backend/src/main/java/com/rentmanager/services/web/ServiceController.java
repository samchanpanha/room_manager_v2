package com.rentmanager.services.web;

import com.rentmanager.platform.security.AuthPrincipal;
import com.rentmanager.platform.security.CurrentUser;
import com.rentmanager.services.dto.CreateServiceRequest;
import com.rentmanager.services.service.ServiceAppService;
import com.rentmanager.services.service.ServiceRules;
import jakarta.validation.Valid;
import java.util.Map;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

/** REST for the M12 service catalog, mirroring {@code src/app/api/services/route.ts}. */
@RestController
@RequestMapping("/api/services")
public class ServiceController {

  private final ServiceAppService service;
  private final CurrentUser currentUser;

  public ServiceController(ServiceAppService service, CurrentUser currentUser) {
    this.service = service;
    this.currentUser = currentUser;
  }

  @GetMapping
  public Map<String, Object> list() {
    AuthPrincipal user = currentUser.require();
    return Map.of(
        "services", service.listCatalog(user),
        "pricingModels", ServiceRules.PRICING_MODELS);
  }

  @PostMapping
  public ResponseEntity<Map<String, String>> create(@Valid @RequestBody CreateServiceRequest body) {
    AuthPrincipal user = currentUser.require();
    String id = service.createService(user, body);
    return ResponseEntity.status(HttpStatus.CREATED).body(Map.of("id", id));
  }
}
