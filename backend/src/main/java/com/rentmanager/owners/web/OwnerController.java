package com.rentmanager.owners.web;

import com.rentmanager.owners.domain.OwnerProfile;
import com.rentmanager.owners.dto.CreateOwnerRequest;
import com.rentmanager.owners.dto.OwnerSummary;
import com.rentmanager.owners.service.OwnerService;
import com.rentmanager.platform.security.AuthPrincipal;
import com.rentmanager.platform.security.CurrentUser;
import jakarta.validation.Valid;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

/** REST for M03, mirroring {@code src/app/api/owners/route.ts}. */
@RestController
@RequestMapping("/api/owners")
public class OwnerController {

  private final OwnerService service;
  private final CurrentUser currentUser;

  public OwnerController(OwnerService service, CurrentUser currentUser) {
    this.service = service;
    this.currentUser = currentUser;
  }

  @GetMapping
  public List<OwnerSummary> list() {
    return service.list(currentUser.require());
  }

  @GetMapping("/{id}")
  public Map<String, Object> get(@PathVariable String id) {
    AuthPrincipal user = currentUser.require();
    OwnerProfile o = service.get(user, id);
    Map<String, Object> out = new LinkedHashMap<>();
    out.put("id", o.getId());
    out.put("status", o.getStatus());
    out.put("companyName", o.getCompanyName());
    out.put("notes", o.getNotes());
    out.put("payoutMethods", o.getPayoutMethods().stream().map(p -> Map.of(
        "id", p.getId(), "kind", p.getKind(), "accountName", p.getAccountName(),
        "accountNumber", p.getAccountNumber(), "isPrimary", p.isPrimary())).toList());
    return out;
  }

  @PostMapping
  public ResponseEntity<Map<String, String>> create(@Valid @RequestBody CreateOwnerRequest body) {
    AuthPrincipal user = currentUser.require();
    String id = service.onboard(user, body);
    return ResponseEntity.status(HttpStatus.CREATED).body(Map.of("id", id));
  }
}
