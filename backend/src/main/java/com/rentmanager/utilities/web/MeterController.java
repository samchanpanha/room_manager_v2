package com.rentmanager.utilities.web;

import com.rentmanager.platform.security.AuthPrincipal;
import com.rentmanager.platform.security.CurrentUser;
import com.rentmanager.utilities.dto.CreateMeterRequest;
import com.rentmanager.utilities.dto.ImportReadingsRequest;
import com.rentmanager.utilities.dto.RecordReadingRequest;
import com.rentmanager.utilities.service.UtilityService;
import jakarta.validation.Valid;
import java.util.List;
import java.util.Map;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

/**
 * REST for meters + readings (INTENT.md M11), mirroring
 * {@code src/app/api/meters/*}.
 */
@RestController
@RequestMapping("/api/meters")
public class MeterController {

  private final UtilityService service;
  private final CurrentUser currentUser;

  public MeterController(UtilityService service, CurrentUser currentUser) {
    this.service = service;
    this.currentUser = currentUser;
  }

  /** GET /api/meters — list meters (optionally filtered by room), scoped. */
  @GetMapping
  public List<UtilityService.MeterSummary> list(@RequestParam(required = false) String roomId) {
    AuthPrincipal user = currentUser.require();
    return service.list(user, roomId);
  }

  /** POST /api/meters — register a meter for a room. */
  @PostMapping
  public ResponseEntity<Map<String, String>> create(@Valid @RequestBody CreateMeterRequest body) {
    AuthPrincipal user = currentUser.require();
    String id = service.createMeter(user, body);
    return ResponseEntity.status(HttpStatus.CREATED).body(Map.of("id", id));
  }

  /** GET /api/meters/{id} — meter detail + reading history for the chart. */
  @GetMapping("/{id}")
  public UtilityService.MeterDetail get(@PathVariable String id) {
    AuthPrincipal user = currentUser.require();
    return service.getMeter(user, id);
  }

  /** POST /api/meters/{id}/readings — record a manual or estimated reading. */
  @PostMapping("/{id}/readings")
  public ResponseEntity<UtilityService.ReadingResult> recordReading(
      @PathVariable String id, @RequestBody RecordReadingRequest body) {
    AuthPrincipal user = currentUser.require();
    return ResponseEntity.status(HttpStatus.CREATED)
        .body(service.recordReading(user, id, body));
  }

  /** POST /api/meters/{id}/readings/import — bulk CSV import. */
  @PostMapping("/{id}/readings/import")
  public UtilityService.ImportResult importReadings(
      @PathVariable String id, @Valid @RequestBody ImportReadingsRequest body) {
    AuthPrincipal user = currentUser.require();
    return service.importReadingsCsv(user, id, body.csv());
  }
}
