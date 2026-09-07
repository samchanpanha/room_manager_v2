package com.rentmanager.leasing.service;

import com.rentmanager.kernel.audit.AuditEntry;
import com.rentmanager.kernel.audit.AuditService;
import com.rentmanager.kernel.numbering.NumberingService;
import com.rentmanager.kernel.tenant.TenantContext;
import com.rentmanager.leasing.domain.Lease;
import com.rentmanager.leasing.domain.LeaseRepository;
import com.rentmanager.leasing.dto.CreateLeaseRequest;
import com.rentmanager.leasing.dto.LeaseSummary;
import com.rentmanager.members.MemberAccessApi;
import com.rentmanager.platform.security.AuthPrincipal;
import com.rentmanager.platform.security.Rbdc;
import com.rentmanager.platform.web.ApiException;
import com.rentmanager.properties.RoomAccessApi;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Leasing use-cases (INTENT.md M05) — published API of the leasing module.
 * Ports {@code src/app/api/leases/route.ts} + {@code src/lib/leases/service.ts}:
 * draft creation with room reservation, activation (occupancy checks + room and
 * member status flips + first-invoice scheduling), notice, and completion /
 * termination.
 */
@Service
public class LeaseAppService {

  private final LeaseRepository leases;
  private final RoomAccessApi rooms;
  private final MemberAccessApi membersApi;
  private final NumberingService numbering;
  private final AuditService audit;

  public LeaseAppService(LeaseRepository leases, RoomAccessApi rooms, MemberAccessApi membersApi,
      NumberingService numbering, AuditService audit) {
    this.leases = leases;
    this.rooms = rooms;
    this.membersApi = membersApi;
    this.numbering = numbering;
    this.audit = audit;
  }

  public record EffectResult(String status, List<String> notes) {}

  // ---- list / get ---------------------------------------------------------

  @Transactional(readOnly = true)
  public List<LeaseSummary> list(AuthPrincipal user, String status) {
    String scope = Rbdc.widestScope(user, "read", "M05");
    if (scope == null) throw ApiException.forbidden("M05", "read");
    String tenantId = TenantContext.get();

    List<Lease> rows;
    if ("GLOBAL".equals(scope)) {
      rows = status != null
          ? leases.findByTenantIdAndStatusOrderByCreatedAtDesc(tenantId, status)
          : leases.findByTenantIdOrderByCreatedAtDesc(tenantId);
    } else if ("PROPERTY".equals(scope)) {
      if (user.propertyIds().isEmpty()) return List.of();
      rows = leases.findByTenantIdAndPropertyIdInOrderByCreatedAtDesc(tenantId, user.propertyIds());
      if (status != null) rows = rows.stream().filter(l -> status.equals(l.getStatus())).toList();
    } else {
      return List.of(); // OWN scope resolves via the tenant portal
    }
    return rows.stream().map(LeaseSummary::from).toList();
  }

  @Transactional(readOnly = true)
  public Lease get(AuthPrincipal user, String id) {
    Lease lease = leases.findByIdAndTenantId(id, TenantContext.get())
        .orElseThrow(() -> ApiException.notFound("Lease not found"));
    if (!Rbdc.can(user, "read", "M05", Rbdc.ResourceRef.property(lease.getPropertyId()))
        && !Rbdc.can(user, "read", "M05")) {
      throw ApiException.forbidden("M05", "read");
    }
    return lease;
  }

  // ---- create (draft) -----------------------------------------------------

  @Transactional
  public LeaseSummary createDraft(AuthPrincipal user, CreateLeaseRequest req) {
    String tenantId = TenantContext.get();
    RoomAccessApi.RoomInfo room = rooms.getRoom(req.roomId());

    if (!Rbdc.can(user, "create", "M05", Rbdc.ResourceRef.property(room.propertyId()))
        && !Rbdc.can(user, "create", "M05")) {
      throw ApiException.forbidden("M05", "create");
    }

    MemberAccessApi.MemberInfo member = membersApi.get(req.memberProfileId());
    if (member.blacklisted()) {
      throw new ApiException(423, "BLACKLISTED", "Member is blacklisted — new leases are blocked");
    }
    if (req.bedId() != null && !rooms.bedBelongsToRoom(req.bedId(), room.id())) {
      throw new ApiException(400, "INVALID_BED", "Bed does not belong to the selected room");
    }
    if (!Occupancy.isMoveInReady(room.status())) {
      throw new ApiException(422, "ROOM_NOT_AVAILABLE",
          "Room status \"" + room.status() + "\" — move-ins need vacant, reserved or occupied (co-living) rooms");
    }
    Instant start = Instant.parse(req.startDate());
    Instant end = req.endDate() != null ? Instant.parse(req.endDate()) : null;
    if (end != null && !end.isAfter(start)) {
      throw new ApiException(400, "INVALID_TERM", "End date must be after the start date");
    }

    String code = numbering.next("LEASE", n -> "LSE-" + String.format("%04d", n));
    Lease lease = new Lease(code, member.id(), room.id(), req.bedId(), room.propertyId(),
        start, toMinor(req.rentAmount()), tenantId);
    lease.setEndDate(end);
    lease.setBillingCycleDay(req.billingCycleDay());
    lease.setProrationBasis(req.prorationBasis());
    lease.setDepositTotalMinor(toMinor(req.depositTotal()));
    lease.setDepositInstallments(req.depositInstallments());
    lease.setNoticeDays(req.noticeDays());
    lease.setAutoRenew(req.autoRenew());
    lease.setEscalationPercent(req.escalationPercent());
    lease.setCreatedById(user.id());
    for (var s : req.services()) {
      lease.getServices().add(new com.rentmanager.leasing.domain.LeaseService(
          s.name(), toMinor(s.amount()), s.pricingModel(), tenantId));
    }
    Lease saved = leases.save(lease);

    // Pipeline effect: vacant room → reserved while the draft is open.
    if ("vacant".equals(room.status())) {
      rooms.setStatus(room.id(), "reserved");
    }

    audit.log(AuditEntry.builder()
        .actorId(user.id()).actorName(user.name())
        .module("M05").action("create").entityType("lease").entityId(saved.getId())
        .summary("Draft lease " + code + " → room " + room.number()
            + (req.bedId() != null ? " (bed)" : "") + ", rent "
            + String.format("%.2f", toMinor(req.rentAmount()) / 100.0) + "/mo, "
            + req.services().size() + " service(s)")
        .build());
    return LeaseSummary.from(saved);
  }

  // ---- activate -----------------------------------------------------------

  @Transactional
  public EffectResult activate(AuthPrincipal user, String leaseId) {
    Lease lease = get(user, leaseId);
    requireUpdate(user, lease);
    if (!LeaseMachine.canTransition(lease.getStatus(), "active")) {
      throw new ApiException(422, "INVALID_TRANSITION", "Cannot activate a " + lease.getStatus() + " lease");
    }
    MemberAccessApi.MemberInfo member = membersApi.get(lease.getMemberProfileId());
    if (member.blacklisted()) {
      throw new ApiException(422, "BLACKLISTED", "Member is blacklisted — new leases are blocked");
    }
    if (!"verified".equals(member.status()) && !"active".equals(member.status())) {
      throw new ApiException(422, "MEMBER_NOT_READY",
          "Member is " + member.status() + " — complete KYC and verify before move-in");
    }

    RoomAccessApi.RoomInfo room = rooms.getRoom(lease.getRoomId());
    String tenantId = TenantContext.get();
    List<Occupancy.LeaseRef> active = new ArrayList<>();
    for (Lease l : leases.findByRoomIdAndStatusAndTenantId(lease.getRoomId(), "active", tenantId)) {
      if (!l.getId().equals(lease.getId())) active.add(new Occupancy.LeaseRef(l.getId(), l.getBedId()));
    }
    Occupancy.Check placement = Occupancy.checkPlacement(
        room.status(), room.capacity(), active, lease.getBedId(), room.bedIds());
    if (!placement.ok()) throw new ApiException(422, placement.code(), placement.message());

    List<String> notes = new ArrayList<>();
    Instant nextBilling = BillingDates.computeNextBillingDate(lease.getStartDate(), lease.getBillingCycleDay());
    lease.setStatus("active");
    lease.setNextBillingDate(nextBilling);
    leases.save(lease);

    if (!"occupied".equals(room.status())) {
      rooms.setStatus(lease.getRoomId(), "occupied");
    }
    if ("verified".equals(member.status())) {
      membersApi.setStatus(member.id(), "active");
      notes.add("member activated");
    }
    notes.add("first invoice scheduled " + nextBilling.toString().substring(0, 10));
    if (lease.getDepositTotalMinor() > 0) {
      // TODO(M10): bill the deposit as a liability-backed installment invoice once
      // the deposits module is ported. Behavior parity noted in the plan.
      notes.add("deposit billing deferred (M10 not yet ported)");
    }

    audit.log(AuditEntry.builder()
        .actorId(user.id()).actorName(user.name())
        .module("M05").action("update").entityType("lease_status").entityId(leaseId)
        .summary("Lease " + lease.getCode() + " → active: " + String.join("; ", notes))
        .build());
    return new EffectResult("active", notes);
  }

  // ---- notice -------------------------------------------------------------

  @Transactional
  public EffectResult giveNotice(AuthPrincipal user, String leaseId, String endDateIso) {
    Lease lease = get(user, leaseId);
    requireUpdate(user, lease);
    if (!LeaseMachine.canTransition(lease.getStatus(), "notice")) {
      throw new ApiException(422, "INVALID_TRANSITION", "Cannot give notice on a " + lease.getStatus() + " lease");
    }
    Instant end = endDateIso != null ? Instant.parse(endDateIso) : lease.getEndDate();
    lease.setStatus("notice");
    lease.setEndDate(end);
    leases.save(lease);

    String tenantId = TenantContext.get();
    long otherActive = leases.countByMemberProfileIdAndStatusAndTenantIdAndIdNot(
        lease.getMemberProfileId(), "active", tenantId, leaseId);
    MemberAccessApi.MemberInfo member = membersApi.get(lease.getMemberProfileId());
    if (otherActive == 0 && "active".equals(member.status())) {
      membersApi.setStatus(member.id(), "notice");
    }

    audit.log(AuditEntry.builder()
        .actorId(user.id()).actorName(user.name())
        .module("M05").action("update").entityType("lease_status").entityId(leaseId)
        .summary("Lease " + lease.getCode() + " → notice (" + lease.getNoticeDays() + "d)")
        .build());
    return new EffectResult("notice", List.of("lease → notice"));
  }

  // ---- complete / terminate ----------------------------------------------

  @Transactional
  public EffectResult end(AuthPrincipal user, String leaseId, String to, String reason) {
    Lease lease = get(user, leaseId);
    requireUpdate(user, lease);
    if (!LeaseMachine.canTransition(lease.getStatus(), to)) {
      throw new ApiException(422, "INVALID_TRANSITION",
          "Cannot move a " + lease.getStatus() + " lease to " + to);
    }
    if ("terminated".equals(to) && (reason == null || reason.isBlank())) {
      throw new ApiException(422, "REASON_REQUIRED", "Termination requires a written reason");
    }
    // TODO(M07): open-dues clearance gate — requires the invoices module.
    // TODO(M18): completed move-out inspection gate — requires the inspections module.
    // Both are enforced in the Next app; they are re-enabled here as those
    // modules are ported (tracked in docs/backend-split-plan.md).

    List<String> notes = new ArrayList<>();
    String tenantId = TenantContext.get();
    lease.setStatus(to);
    lease.setTerminatedAt("terminated".equals(to) ? Instant.now() : null);
    lease.setTerminationReason("terminated".equals(to) ? reason : null);
    lease.setNextBillingDate(null);
    leases.save(lease);

    RoomAccessApi.RoomInfo room = rooms.getRoom(lease.getRoomId());
    long stillActive = leases.countByRoomIdAndStatusAndTenantIdAndIdNot(
        lease.getRoomId(), "active", tenantId, leaseId);
    if (stillActive == 0 && "occupied".equals(room.status())) {
      rooms.setStatus(lease.getRoomId(), "cleaning");
      notes.add("room → cleaning");
    }
    long memberActive = leases.countByMemberProfileIdAndStatusAndTenantIdAndIdNot(
        lease.getMemberProfileId(), "active", tenantId, leaseId);
    MemberAccessApi.MemberInfo member = membersApi.get(lease.getMemberProfileId());
    if (memberActive == 0 && ("active".equals(member.status()) || "notice".equals(member.status()))) {
      membersApi.setStatus(member.id(), "moved_out");
      notes.add("member → moved_out");
    }
    if (lease.getDepositTotalMinor() > 0) {
      notes.add("deposit settlement triggered (M10 acts once ported)");
    }

    audit.log(AuditEntry.builder()
        .actorId(user.id()).actorName(user.name())
        .module("M05").action(to.equals("terminated") ? "void" : "update")
        .entityType("lease_status").entityId(leaseId)
        .summary("Lease " + lease.getCode() + " → " + to + ": " + String.join("; ", notes))
        .build());
    return new EffectResult(to, notes);
  }

  // ---- helpers ------------------------------------------------------------

  private void requireUpdate(AuthPrincipal user, Lease lease) {
    if (!Rbdc.can(user, "update", "M05", Rbdc.ResourceRef.property(lease.getPropertyId()))
        && !Rbdc.can(user, "update", "M05")) {
      throw ApiException.forbidden("M05", "update");
    }
  }

  private static int toMinor(double major) {
    return (int) Math.round(major * 100);
  }
}
