package com.rentmanager.members.web;

import com.rentmanager.members.domain.MemberProfile;
import com.rentmanager.members.dto.CreateMemberRequest;
import com.rentmanager.members.dto.MemberSummary;
import com.rentmanager.members.service.MemberService;
import com.rentmanager.platform.security.AuthPrincipal;
import com.rentmanager.platform.security.CurrentUser;
import jakarta.validation.Valid;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

/** REST for M02, mirroring {@code src/app/api/members/route.ts}. */
@RestController
@RequestMapping("/api/members")
public class MemberController {

  private final MemberService service;
  private final CurrentUser currentUser;

  public MemberController(MemberService service, CurrentUser currentUser) {
    this.service = service;
    this.currentUser = currentUser;
  }

  @GetMapping
  public List<MemberSummary> list(
      @RequestParam(required = false) String status,
      @RequestParam(required = false) String propertyId) {
    AuthPrincipal user = currentUser.require();
    return service.list(user, status, propertyId);
  }

  @GetMapping("/{id}")
  public Map<String, Object> get(@PathVariable String id) {
    AuthPrincipal user = currentUser.require();
    MemberProfile m = service.get(user, id);
    Map<String, Object> out = new LinkedHashMap<>();
    out.put("id", m.getId());
    out.put("status", m.getStatus());
    out.put("blacklisted", m.isBlacklisted());
    out.put("homePropertyId", m.getHomePropertyId());
    out.put("nationality", m.getNationality());
    out.put("idNumber", m.getIdNumber());
    out.put("occupation", m.getOccupation());
    out.put("notes", m.getNotes());
    out.put("emergencyContacts", m.getEmergencyContacts().stream().map(c -> Map.of(
        "id", c.getId(), "name", c.getName(), "relationship", c.getRelationship(),
        "phone", c.getPhone(), "isPrimary", c.isPrimary())).toList());
    return out;
  }

  @PostMapping
  public ResponseEntity<Map<String, String>> create(@Valid @RequestBody CreateMemberRequest body) {
    AuthPrincipal user = currentUser.require();
    String id = service.onboard(user, body);
    return ResponseEntity.status(HttpStatus.CREATED).body(Map.of("id", id));
  }
}
