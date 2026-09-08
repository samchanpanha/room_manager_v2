package com.rentmanager.utilities.web;

import com.rentmanager.platform.security.AuthPrincipal;
import com.rentmanager.platform.security.CurrentUser;
import com.rentmanager.utilities.dto.CreateTariffRequest;
import com.rentmanager.utilities.service.UtilityService;
import jakarta.validation.Valid;
import java.util.List;
import java.util.Map;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

/** REST for tariffs (INTENT.md M11), mirroring {@code src/app/api/tariffs/route.ts}. */
@RestController
@RequestMapping("/api/tariffs")
public class TariffController {

  private final UtilityService service;
  private final CurrentUser currentUser;

  public TariffController(UtilityService service, CurrentUser currentUser) {
    this.service = service;
    this.currentUser = currentUser;
  }

  @GetMapping
  public List<UtilityService.TariffView> list() {
    AuthPrincipal user = currentUser.require();
    return service.listTariffs(user);
  }

  @PostMapping
  public ResponseEntity<Map<String, String>> create(@Valid @RequestBody CreateTariffRequest body) {
    AuthPrincipal user = currentUser.require();
    String id = service.createTariff(user, body);
    return ResponseEntity.status(HttpStatus.CREATED).body(Map.of("id", id));
  }
}
