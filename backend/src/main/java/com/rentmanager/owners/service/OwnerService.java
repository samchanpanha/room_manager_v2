package com.rentmanager.owners.service;

import com.rentmanager.iam.PortalUserApi;
import com.rentmanager.kernel.audit.AuditEntry;
import com.rentmanager.kernel.audit.AuditService;
import com.rentmanager.kernel.party.Party;
import com.rentmanager.kernel.party.PartyRepository;
import com.rentmanager.kernel.tenant.TenantContext;
import com.rentmanager.owners.domain.OwnerPayoutMethod;
import com.rentmanager.owners.domain.OwnerProfile;
import com.rentmanager.owners.domain.OwnerRepository;
import com.rentmanager.owners.dto.CreateOwnerRequest;
import com.rentmanager.owners.dto.OwnerSummary;
import com.rentmanager.platform.security.AuthPrincipal;
import com.rentmanager.platform.security.Rbdc;
import com.rentmanager.platform.web.ApiException;
import com.rentmanager.properties.BuildingOwnershipApi;
import java.util.List;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Owners use-cases (INTENT.md M03) — published API of the owners module. Ports
 * {@code src/app/api/owners/route.ts} and the owners list page scoping in
 * {@code src/lib/owners.ts}.
 */
@Service
public class OwnerService {

  private final OwnerRepository owners;
  private final PartyRepository parties;
  private final BuildingOwnershipApi buildingOwnership;
  private final PortalUserApi portalUsers;
  private final AuditService audit;

  public OwnerService(OwnerRepository owners, PartyRepository parties,
      BuildingOwnershipApi buildingOwnership, PortalUserApi portalUsers, AuditService audit) {
    this.owners = owners;
    this.parties = parties;
    this.buildingOwnership = buildingOwnership;
    this.portalUsers = portalUsers;
    this.audit = audit;
  }

  /**
   * List owners honoring M03 read scope:
   * GLOBAL → all; OWN → the owner profile linked to the caller's party; else empty.
   * (PROPERTY scope — owners of buildings in assigned properties — is resolved in
   * a later phase once the owner↔building read join is ported.)
   */
  @Transactional(readOnly = true)
  public List<OwnerSummary> list(AuthPrincipal user) {
    String scope = Rbdc.widestScope(user, "read", "M03");
    if (scope == null) throw ApiException.forbidden("M03", "read");
    String tenantId = TenantContext.get();

    if ("GLOBAL".equals(scope)) {
      return owners.findByTenantIdOrderByCreatedAt(tenantId).stream().map(OwnerSummary::from).toList();
    }
    if ("OWN".equals(scope) && user.partyId() != null) {
      return owners.findByTenantIdOrderByCreatedAt(tenantId).stream()
          .filter(o -> user.partyId().equals(o.getPartyId()))
          .map(OwnerSummary::from).toList();
    }
    return List.of();
  }

  @Transactional(readOnly = true)
  public OwnerProfile get(AuthPrincipal user, String id) {
    OwnerProfile o = owners.findByIdAndTenantId(id, TenantContext.get())
        .orElseThrow(() -> ApiException.notFound("Owner not found"));
    boolean owns = user.partyId() != null && user.partyId().equals(o.getPartyId());
    if (!Rbdc.can(user, "read", "M03")
        && !(owns && Rbdc.can(user, "read", "M03", Rbdc.ResourceRef.own(user.id())))) {
      throw ApiException.forbidden("M03", "read");
    }
    return o;
  }

  /**
   * Onboard an owner (M03): party + profile + primary payout method, optional
   * building ownership and optional portal login. Atomic — mirrors the Next
   * route's {@code prisma.$transaction}.
   */
  @Transactional
  public String onboard(AuthPrincipal user, CreateOwnerRequest req) {
    if (!Rbdc.can(user, "create", "M03")) throw ApiException.forbidden("M03", "create");
    String tenantId = TenantContext.get();

    if (req.email() != null && !req.email().isBlank()) {
      parties.findByEmailIgnoreCaseAndTenantId(req.email().toLowerCase(), tenantId).ifPresent(p -> {
        throw ApiException.duplicate("A party with this email already exists");
      });
    }
    // Pre-flight building ownership (fail fast before writing anything).
    for (String buildingId : req.buildingIds()) {
      var ownership = buildingOwnership.ownership(buildingId);
      if (ownership.ownerProfileId() != null) {
        throw new ApiException(409, "BUILDING_OWNED",
            ownership.name() + " is already owned — unassign it first");
      }
    }

    String type = req.companyName() != null && !req.companyName().isBlank() ? "COMPANY" : "PERSON";
    Party party = parties.save(new Party(type, req.name(),
        req.email() != null ? req.email().toLowerCase() : null, req.phone(), tenantId));

    OwnerProfile profile = new OwnerProfile(party.getId(), req.companyName(), req.notes(), tenantId);
    if (req.payoutMethod() != null) {
      var pm = req.payoutMethod();
      profile.getPayoutMethods().add(new OwnerPayoutMethod(
          pm.kind(), pm.bankName(), pm.accountName(), pm.accountNumber(), true, tenantId));
    }
    OwnerProfile saved = owners.save(profile);

    if (!req.buildingIds().isEmpty()) {
      buildingOwnership.assignToOwner(req.buildingIds(), saved.getId());
    }
    if (req.portalLogin() != null) {
      portalUsers.createPortalUser(req.portalLogin().email(), req.name(),
          req.portalLogin().password(), party.getId(), "OWNER");
    }

    audit.log(AuditEntry.builder()
        .actorId(user.id()).actorName(user.name())
        .module("M03").action("create").entityType("owner").entityId(saved.getId())
        .summary("Onboarded owner " + req.name()
            + (req.companyName() != null ? " (" + req.companyName() + ")" : "")
            + (req.buildingIds().isEmpty() ? "" : " with " + req.buildingIds().size() + " building(s)")
            + (req.portalLogin() != null ? " + portal login " + req.portalLogin().email() : ""))
        .build());
    return saved.getId();
  }
}
