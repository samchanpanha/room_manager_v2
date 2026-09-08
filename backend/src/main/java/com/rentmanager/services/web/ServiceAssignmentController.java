package com.rentmanager.services.web;

import com.rentmanager.platform.security.AuthPrincipal;
import com.rentmanager.platform.security.CurrentUser;
import com.rentmanager.services.dto.AssignServiceRequest;
import com.rentmanager.services.dto.SuspendAssignmentRequest;
import com.rentmanager.services.service.ServiceAppService;
import jakarta.validation.Valid;
import java.time.Instant;
import java.util.Map;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

/**
 * REST for M12 service assignments, mirroring
 * {@code src/app/api/services/assignments/*}.
 */
@RestController
@RequestMapping("/api/services/assignments")
public class ServiceAssignmentController {

  private final ServiceAppService service;
  private final CurrentUser currentUser;

  public ServiceAssignmentController(ServiceAppService service, CurrentUser currentUser) {
    this.service = service;
    this.currentUser = currentUser;
  }

  @GetMapping
  public Map<String, Object> list() {
    AuthPrincipal user = currentUser.require();
    return Map.of("assignments", service.listAssignments(user));
  }

  @PostMapping
  public ResponseEntity<Map<String, String>> assign(@Valid @RequestBody AssignServiceRequest body) {
    AuthPrincipal user = currentUser.require();
    String id = service.assignService(user, body);
    return ResponseEntity.status(HttpStatus.CREATED).body(Map.of("assignmentId", id));
  }

  @PostMapping("/{id}/suspend")
  public Map<String, Object> suspend(
      @PathVariable String id, @RequestBody(required = false) SuspendAssignmentRequest body) {
    AuthPrincipal user = currentUser.require();
    Instant at = body != null ? body.at() : null;
    Instant suspendedAt = service.suspendAssignment(user, id, at);
    return Map.of("suspendedAt", suspendedAt);
  }
}
