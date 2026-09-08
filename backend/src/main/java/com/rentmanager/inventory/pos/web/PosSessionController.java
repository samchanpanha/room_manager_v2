package com.rentmanager.inventory.pos.web;

import com.rentmanager.inventory.pos.dto.PosDtos.CloseSessionRequest;
import com.rentmanager.inventory.pos.dto.PosDtos.OpenSessionRequest;
import com.rentmanager.inventory.pos.service.PosService;
import com.rentmanager.platform.security.AuthPrincipal;
import com.rentmanager.platform.security.CurrentUser;
import com.rentmanager.platform.web.ApiException;
import java.util.Map;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

/**
 * M14 POS cash-drawer sessions, mirroring {@code src/app/api/pos/sessions/*}.
 * One open session per property; close reports expected-vs-counted variance.
 */
@RestController
@RequestMapping("/api/pos/sessions")
public class PosSessionController {

  private final PosService pos;
  private final CurrentUser currentUser;

  public PosSessionController(PosService pos, CurrentUser currentUser) {
    this.pos = pos;
    this.currentUser = currentUser;
  }

  @GetMapping
  public Map<String, Object> list() {
    return Map.of("sessions", pos.listSessions(currentUser.require()));
  }

  @PostMapping
  public ResponseEntity<PosService.OpenResult> open(@RequestBody OpenSessionRequest body) {
    AuthPrincipal user = currentUser.require();
    if (body.propertyId() == null || body.propertyId().isBlank()) {
      throw ApiException.validation("propertyId is required");
    }
    double f = body.openingFloat() != null ? body.openingFloat() : 0;
    int floatMinor = (int) Math.round(f * 100);
    return ResponseEntity.status(HttpStatus.CREATED)
        .body(pos.openSession(user, body.propertyId(), floatMinor));
  }

  @PostMapping("/{id}/close")
  public PosService.CloseResult close(@PathVariable String id, @RequestBody CloseSessionRequest body) {
    AuthPrincipal user = currentUser.require();
    if (body.counted() == null) throw ApiException.validation("counted is required");
    int countedMinor = (int) Math.round(body.counted() * 100);
    return pos.closeSession(user, id, countedMinor, body.note());
  }
}
