package com.rentmanager.members.service;

import com.rentmanager.kernel.audit.AuditEntry;
import com.rentmanager.kernel.audit.AuditService;
import com.rentmanager.kernel.party.Party;
import com.rentmanager.kernel.party.PartyRepository;
import com.rentmanager.members.domain.EmergencyContact;
import com.rentmanager.members.domain.MemberProfile;
import com.rentmanager.members.domain.MemberRepository;
import com.rentmanager.members.dto.CreateMemberRequest;
import com.rentmanager.members.dto.MemberSummary;
import com.rentmanager.platform.security.AuthPrincipal;
import com.rentmanager.platform.security.Rbdc;
import com.rentmanager.kernel.tenant.TenantContext;
import com.rentmanager.platform.web.ApiException;
import java.util.List;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Members use-cases (INTENT.md M02) — the published API of the members module.
 * Ports {@code src/app/api/members/route.ts} + {@code src/app/(admin)/members}
 * server logic, including RBDC scope resolution.
 */
@Service
public class MemberService {

  private final MemberRepository members;
  private final PartyRepository parties;
  private final AuditService audit;

  public MemberService(MemberRepository members, PartyRepository parties, AuditService audit) {
    this.members = members;
    this.parties = parties;
    this.audit = audit;
  }

  /**
   * List members honoring RBDC read scope for M02:
   * GLOBAL → all; PROPERTY → assigned properties; OWN/none → empty (portal path).
   */
  @Transactional(readOnly = true)
  public List<MemberSummary> list(AuthPrincipal user, String status, String propertyId) {
    String scope = Rbdc.widestScope(user, "read", "M02");
    if (scope == null) throw ApiException.forbidden("M02", "read");
    String tenantId = TenantContext.get();

    List<MemberProfile> rows;
    if ("GLOBAL".equals(scope)) {
      rows = members.search(tenantId, status, propertyId);
    } else if ("PROPERTY".equals(scope)) {
      // Restrict to a requested property only if the user is assigned to it.
      if (propertyId != null && !user.propertyIds().contains(propertyId)) return List.of();
      rows = members.search(tenantId, status, propertyId).stream()
          .filter(m -> m.getHomePropertyId() != null && user.propertyIds().contains(m.getHomePropertyId()))
          .toList();
    } else {
      // OWN scope resolves through the tenant portal, not this admin endpoint.
      return List.of();
    }
    return rows.stream().map(MemberSummary::from).toList();
  }

  @Transactional(readOnly = true)
  public MemberProfile get(AuthPrincipal user, String id) {
    MemberProfile m = members.findByIdAndTenantId(id, TenantContext.get())
        .orElseThrow(() -> ApiException.notFound("Member not found"));
    if (!Rbdc.can(user, "read", "M02", Rbdc.ResourceRef.property(m.getHomePropertyId()))
        && !Rbdc.can(user, "read", "M02")) {
      throw ApiException.forbidden("M02", "read");
    }
    return m;
  }

  /** Member onboarding (M02): party + profile + emergency contacts, atomically. */
  @Transactional
  public String onboard(AuthPrincipal user, CreateMemberRequest req) {
    String tenantId = TenantContext.get();

    // Authorize create at the home property scope, matching the Next route.
    Rbdc.ResourceRef ref = req.homePropertyId() != null
        ? Rbdc.ResourceRef.property(req.homePropertyId()) : null;
    if (!Rbdc.can(user, "create", "M02", ref) && !Rbdc.can(user, "create", "M02")) {
      throw ApiException.forbidden("M02", "create");
    }

    if (req.email() != null && !req.email().isBlank()) {
      parties.findByEmailIgnoreCaseAndTenantId(req.email().toLowerCase(), tenantId)
          .ifPresent(p -> { throw ApiException.duplicate("A member with this email already exists"); });
    }

    Party party = parties.save(new Party("PERSON", req.name(),
        req.email() != null ? req.email().toLowerCase() : null, req.phone(), tenantId));

    MemberProfile profile = new MemberProfile(party.getId(), tenantId);
    profile.setHomePropertyId(req.homePropertyId());
    profile.setNationality(req.nationality());
    profile.setIdNumber(req.idNumber());
    profile.setOccupation(req.occupation());
    profile.setMonthlyIncomeMinor(req.monthlyIncome() == null ? null : toMinor(req.monthlyIncome()));
    profile.setNotes(req.notes());
    for (var c : req.emergencyContacts()) {
      profile.getEmergencyContacts().add(new EmergencyContact(
          c.name(), c.relationship(), c.phone(), c.email(), c.isPrimary(), tenantId));
    }
    MemberProfile saved = members.save(profile);

    audit.log(AuditEntry.builder()
        .actorId(user.id()).actorName(user.name())
        .module("M02").action("create").entityType("member").entityId(saved.getId())
        .summary("Onboarded member " + party.getName() + " (prospect) with "
            + saved.getEmergencyContacts().size() + " emergency contact(s)")
        .build());
    return saved.getId();
  }

  /** Money helper — integer minor units (INTENT.md §2), mirrors src/lib/money.ts toMinor. */
  private static int toMinor(double major) {
    return (int) Math.round(major * 100);
  }
}
