package com.rentmanager.leasing.web;

import com.rentmanager.leasing.domain.Lease;
import com.rentmanager.leasing.dto.CreateLeaseRequest;
import com.rentmanager.leasing.dto.EndLeaseRequest;
import com.rentmanager.leasing.dto.LeaseSummary;
import com.rentmanager.leasing.dto.NoticeRequest;
import com.rentmanager.leasing.service.LeaseAppService;
import com.rentmanager.leasing.service.LeaseAppService.EffectResult;
import com.rentmanager.platform.security.AuthPrincipal;
import com.rentmanager.platform.security.CurrentUser;
import jakarta.validation.Valid;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

/**
 * REST for M05, mirroring {@code src/app/api/leases/*}:
 * list/create, get, and the lifecycle actions activate/notice/complete/terminate.
 */
@RestController
@RequestMapping("/api/leases")
public class LeaseController {

  private final LeaseAppService service;
  private final CurrentUser currentUser;

  public LeaseController(LeaseAppService service, CurrentUser currentUser) {
    this.service = service;
    this.currentUser = currentUser;
  }

  @GetMapping
  public List<LeaseSummary> list(@RequestParam(required = false) String status) {
    return service.list(currentUser.require(), status);
  }

  @GetMapping("/{id}")
  public Map<String, Object> get(@PathVariable String id) {
    AuthPrincipal user = currentUser.require();
    Lease l = service.get(user, id);
    Map<String, Object> out = new LinkedHashMap<>();
    out.put("id", l.getId());
    out.put("code", l.getCode());
    out.put("status", l.getStatus());
    out.put("memberProfileId", l.getMemberProfileId());
    out.put("roomId", l.getRoomId());
    out.put("bedId", l.getBedId());
    out.put("propertyId", l.getPropertyId());
    out.put("rentAmountMinor", l.getRentAmountMinor());
    out.put("billingCycleDay", l.getBillingCycleDay());
    out.put("prorationBasis", l.getProrationBasis());
    out.put("depositTotalMinor", l.getDepositTotalMinor());
    out.put("noticeDays", l.getNoticeDays());
    out.put("autoRenew", l.isAutoRenew());
    out.put("startDate", l.getStartDate() == null ? null : l.getStartDate().toString());
    out.put("endDate", l.getEndDate() == null ? null : l.getEndDate().toString());
    out.put("nextBillingDate", l.getNextBillingDate() == null ? null : l.getNextBillingDate().toString());
    out.put("services", l.getServices().stream().map(s -> Map.of(
        "id", s.getId(), "name", s.getName(), "amountMinor", s.getAmountMinor(),
        "pricingModel", s.getPricingModel())).toList());
    return out;
  }

  @PostMapping
  public ResponseEntity<Map<String, String>> create(@Valid @RequestBody CreateLeaseRequest body) {
    LeaseSummary s = service.createDraft(currentUser.require(), body);
    return ResponseEntity.status(HttpStatus.CREATED).body(Map.of("id", s.id(), "code", s.code()));
  }

  @PostMapping("/{id}/activate")
  public Map<String, Object> activate(@PathVariable String id) {
    EffectResult r = service.activate(currentUser.require(), id);
    return Map.of("status", r.status(), "notes", r.notes());
  }

  @PostMapping("/{id}/notice")
  public Map<String, Object> notice(@PathVariable String id, @RequestBody(required = false) NoticeRequest body) {
    EffectResult r = service.giveNotice(currentUser.require(), id, body == null ? null : body.endDate());
    return Map.of("status", r.status(), "notes", r.notes());
  }

  @PostMapping("/{id}/complete")
  public Map<String, Object> complete(@PathVariable String id) {
    EffectResult r = service.end(currentUser.require(), id, "completed", null);
    return Map.of("status", r.status(), "notes", r.notes());
  }

  @PostMapping("/{id}/terminate")
  public Map<String, Object> terminate(@PathVariable String id, @RequestBody(required = false) EndLeaseRequest body) {
    EffectResult r = service.end(currentUser.require(), id, "terminated", body == null ? null : body.reason());
    return Map.of("status", r.status(), "notes", r.notes());
  }
}
