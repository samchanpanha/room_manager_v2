package com.rentmanager.services.service;

import com.rentmanager.kernel.audit.AuditEntry;
import com.rentmanager.kernel.audit.AuditService;
import com.rentmanager.kernel.tenant.TenantContext;
import com.rentmanager.leasing.LeasingQueryApi;
import com.rentmanager.platform.security.AuthPrincipal;
import com.rentmanager.platform.security.Rbdc;
import com.rentmanager.platform.web.ApiException;
import com.rentmanager.services.domain.*;
import com.rentmanager.services.dto.*;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Services application service (INTENT.md M12) — a faithful port of
 * {@code src/lib/services/service.ts}. Owns the catalog, lease assignments,
 * parking/WiFi binding and per-use entries. Billing integration:
 * <ul>
 *   <li>fixed_monthly assignments write a lease {@code LeaseService} snapshot
 *       (via {@link LeasingQueryApi}) with an [activeFrom, activeThrough) window
 *       the rent engine prorates — mid-cycle suspend/end → prorated stop;</li>
 *   <li>per_use entries become pending {@link ServiceUsage} rows folded into the
 *       lease's next invoice through the billing {@code ServiceUsageBillingPort};</li>
 *   <li>metered services ride on M11 meters.</li>
 * </ul>
 * Enforces RBDC module {@code M12}, scoping by the lease's property.
 */
@Service
public class ServiceAppService {

  private final ServiceRepositories.Catalog catalog;
  private final ServiceRepositories.Assignments assignments;
  private final ServiceRepositories.Usages usages;
  private final ServiceRepositories.ParkingSlots parkingSlots;
  private final ServiceRepositories.WifiAccounts wifiAccounts;
  private final LeasingQueryApi leasingApi;
  private final AuditService audit;

  public ServiceAppService(ServiceRepositories.Catalog catalog,
      ServiceRepositories.Assignments assignments, ServiceRepositories.Usages usages,
      ServiceRepositories.ParkingSlots parkingSlots, ServiceRepositories.WifiAccounts wifiAccounts,
      LeasingQueryApi leasingApi, AuditService audit) {
    this.catalog = catalog;
    this.assignments = assignments;
    this.usages = usages;
    this.parkingSlots = parkingSlots;
    this.wifiAccounts = wifiAccounts;
    this.leasingApi = leasingApi;
    this.audit = audit;
  }

  // ---- catalog -------------------------------------------------------------

  public record CatalogView(String id, String code, String name, String pricingModel,
      int unitPriceMinor, String unitLabel, boolean active) {}

  @Transactional(readOnly = true)
  public List<CatalogView> listCatalog(AuthPrincipal user) {
    if (!Rbdc.hasModuleAccess(user, "read", "M12")) throw ApiException.forbidden("M12", "read");
    return catalog.findByTenantIdOrderByCodeAsc(TenantContext.get()).stream()
        .map(s -> new CatalogView(s.getId(), s.getCode(), s.getName(), s.getPricingModel(),
            s.getUnitPriceMinor(), s.getUnitLabel(), s.isActive()))
        .toList();
  }

  /** Create a catalog service (M12 update, GLOBAL grant — no property resource). */
  @Transactional
  public String createService(AuthPrincipal user, CreateServiceRequest req) {
    String tenantId = TenantContext.get();
    if (!Rbdc.can(user, "update", "M12")) throw ApiException.forbidden("M12", "update");
    if (!ServiceRules.isPricingModel(req.pricingModel())) {
      throw ApiException.validation("pricingModel must be one of "
          + String.join(", ", ServiceRules.PRICING_MODELS));
    }
    if (!ServiceRules.isValidCode(req.code())) {
      throw ApiException.validation("code must be 2–20 chars A-Z 0-9 dash");
    }
    if (catalog.existsByCodeAndTenantId(req.code(), tenantId)) {
      throw ApiException.duplicate("Service code " + req.code() + " already exists");
    }
    int unitPriceMinor = (int) Math.round(req.price() * 100);
    ServiceCatalog service = new ServiceCatalog(req.code(), req.name(), req.pricingModel(),
        unitPriceMinor, req.unitLabel(), tenantId);
    catalog.save(service);
    audit.log(AuditEntry.builder()
        .actorId(user.id()).actorName(user.name())
        .module("M12").action("service.created").entityType("service_catalog")
        .entityId(service.getId())
        .summary("Service \"" + service.getName() + "\" (" + req.pricingModel()
            + ") added to catalog at " + String.format("%.2f", unitPriceMinor / 100.0))
        .build());
    return service.getId();
  }

  // ---- assignments ---------------------------------------------------------

  public record AssignmentView(String id, String serviceCode, String serviceName,
      String pricingModel, String leaseId, String leaseCode, String status, Instant startDate,
      Instant suspendedAt, Instant endedAt, String parkingSlotCode, String wifiSsid) {}

  @Transactional(readOnly = true)
  public List<AssignmentView> listAssignments(AuthPrincipal user) {
    String tenantId = TenantContext.get();
    String scope = Rbdc.widestScope(user, "read", "M12");
    if (scope == null) throw ApiException.forbidden("M12", "read");
    List<AssignmentView> out = new ArrayList<>();
    for (ServiceAssignment a : assignments.findByTenantIdOrderByCreatedAtDesc(tenantId)) {
      LeasingQueryApi.LeaseInfo lease = safeLease(a.getLeaseId());
      if (lease == null) continue;
      if (!"GLOBAL".equals(scope) && !user.propertyIds().contains(lease.propertyId())) continue;
      ServiceCatalog svc = catalog.findByIdAndTenantId(a.getServiceId(), tenantId).orElse(null);
      String slotCode = a.getParkingSlotId() == null ? null
          : parkingSlots.findById(a.getParkingSlotId()).map(ParkingSlot::getCode).orElse(null);
      String ssid = a.getWifiAccountId() == null ? null
          : wifiAccounts.findById(a.getWifiAccountId()).map(WifiAccount::getSsid).orElse(null);
      out.add(new AssignmentView(a.getId(),
          svc != null ? svc.getCode() : null, svc != null ? svc.getName() : null,
          svc != null ? svc.getPricingModel() : null,
          a.getLeaseId(), lease.code(), a.getStatus(), a.getStartDate(), a.getSuspendedAt(),
          a.getEndedAt(), slotCode, ssid));
    }
    return out;
  }

  /**
   * Assign a catalog service to an active lease (M12 create). Parking binds a
   * free slot in the lease's property; WiFi activates a free account;
   * fixed_monthly writes the billing snapshot. Port of {@code assignService}.
   */
  @Transactional
  public String assignService(AuthPrincipal user, AssignServiceRequest req) {
    String tenantId = TenantContext.get();
    LeasingQueryApi.LeaseInfo lease = leasingApi.get(req.leaseId());
    if (!Rbdc.can(user, "create", "M12", Rbdc.ResourceRef.property(lease.propertyId()))) {
      throw ApiException.forbidden("M12", "create");
    }
    if (!"active".equals(lease.status())) {
      throw new ApiException(422, "LEASE_NOT_ACTIVE",
          "Services can only be assigned to an active lease");
    }
    ServiceCatalog service = catalog.findByIdAndTenantId(req.serviceId(), tenantId)
        .filter(ServiceCatalog::isActive)
        .orElseThrow(() -> ApiException.notFound("Catalog service not found or inactive"));

    String parkingSlotId = null;
    String wifiAccountId = null;
    int priceMinor = service.getUnitPriceMinor();
    String nameSuffix = "";

    if (req.parkingSlotCode() != null && !req.parkingSlotCode().isBlank()) {
      if (!"fixed_monthly".equals(service.getPricingModel())) {
        throw ApiException.validation("Parking binds to fixed_monthly services");
      }
      ParkingSlot slot = parkingSlots.findByCodeAndTenantId(req.parkingSlotCode(), tenantId)
          .orElseThrow(() -> ApiException.notFound(
              "Parking slot " + req.parkingSlotCode() + " not found"));
      if (!"free".equals(slot.getStatus())) {
        throw new ApiException(422, "SLOT_TAKEN",
            "Parking slot " + slot.getCode() + " is already assigned");
      }
      if (!slot.getPropertyId().equals(lease.propertyId())) {
        throw new ApiException(422, "SLOT_OTHER_PROPERTY",
            "Parking slot belongs to another property");
      }
      parkingSlotId = slot.getId();
      priceMinor = slot.getMonthlyFeeMinor() != 0 ? slot.getMonthlyFeeMinor() : service.getUnitPriceMinor();
      nameSuffix = " (" + slot.getCode() + ")";
    }
    if (req.wifiSsid() != null && !req.wifiSsid().isBlank()) {
      if (!"fixed_monthly".equals(service.getPricingModel())) {
        throw ApiException.validation("WiFi binds to fixed_monthly services");
      }
      WifiAccount wifi = wifiAccounts.findBySsidAndTenantId(req.wifiSsid(), tenantId)
          .orElseThrow(() -> ApiException.notFound(
              "WiFi account " + req.wifiSsid() + " not found"));
      if (!"free".equals(wifi.getStatus())) {
        throw new ApiException(422, "WIFI_TAKEN",
            "WiFi account " + wifi.getSsid() + " is already assigned");
      }
      if (!wifi.getPropertyId().equals(lease.propertyId())) {
        throw new ApiException(422, "WIFI_OTHER_PROPERTY",
            "WiFi account belongs to another property");
      }
      wifiAccountId = wifi.getId();
    }

    Instant startDate = req.startDate() != null ? req.startDate() : Instant.now();
    String snapshotId = null;
    if ("fixed_monthly".equals(service.getPricingModel())) {
      snapshotId = leasingApi.createServiceSnapshot(req.leaseId(),
          service.getName() + nameSuffix, priceMinor, startDate);
    }
    ServiceAssignment assignment = new ServiceAssignment(service.getId(), req.leaseId(), startDate,
        parkingSlotId, wifiAccountId, snapshotId, req.note(), tenantId);
    assignments.save(assignment);

    if (parkingSlotId != null) {
      parkingSlots.findById(parkingSlotId).ifPresent(s -> { s.setStatus("assigned"); parkingSlots.save(s); });
    }
    if (wifiAccountId != null) {
      wifiAccounts.findById(wifiAccountId).ifPresent(w -> { w.setStatus("assigned"); wifiAccounts.save(w); });
    }

    audit.log(AuditEntry.builder()
        .actorId(user.id()).actorName(user.name())
        .module("M12").action("service.assigned").entityType("service_assignment")
        .entityId(assignment.getId())
        .summary(service.getName() + " assigned to " + lease.code()
            + (req.parkingSlotCode() != null && !req.parkingSlotCode().isBlank()
                ? " — slot " + req.parkingSlotCode() : "")
            + (req.wifiSsid() != null && !req.wifiSsid().isBlank()
                ? " — WiFi " + req.wifiSsid() + " activated" : ""))
        .build());
    return assignment.getId();
  }

  /**
   * Suspend an assignment mid-cycle (M12 update): close the billing window at
   * {@code at} so the current period bills only the active days; suspend the
   * WiFi account. Port of {@code suspendAssignment}.
   */
  @Transactional
  public Instant suspendAssignment(AuthPrincipal user, String assignmentId, Instant at) {
    String tenantId = TenantContext.get();
    ServiceAssignment a = assignments.findByIdAndTenantId(assignmentId, tenantId)
        .orElseThrow(() -> ApiException.notFound("Assignment not found"));
    LeasingQueryApi.LeaseInfo lease = leasingApi.get(a.getLeaseId());
    if (!Rbdc.can(user, "update", "M12", Rbdc.ResourceRef.property(lease.propertyId()))) {
      throw ApiException.forbidden("M12", "update");
    }
    if (!"active".equals(a.getStatus())) {
      throw new ApiException(422, "INVALID_TRANSITION",
          "Cannot suspend a " + a.getStatus() + " assignment");
    }
    Instant when = at != null ? at : Instant.now();
    if (when.isBefore(a.getStartDate())) {
      throw new ApiException(422, "INVALID_DATE", "Suspension date is before the assignment start");
    }
    a.suspend(when);
    assignments.save(a);
    if (a.getSnapshotId() != null) leasingApi.closeServiceSnapshot(a.getSnapshotId(), when);
    if (a.getWifiAccountId() != null) {
      wifiAccounts.findById(a.getWifiAccountId())
          .ifPresent(w -> { w.setStatus("suspended"); wifiAccounts.save(w); });
    }
    ServiceCatalog svc = catalog.findByIdAndTenantId(a.getServiceId(), tenantId).orElse(null);
    audit.log(AuditEntry.builder()
        .actorId(user.id()).actorName(user.name())
        .module("M12").action("service.suspended").entityType("service_assignment")
        .entityId(assignmentId)
        .summary((svc != null ? svc.getName() : "Service") + " suspended for " + lease.code()
            + " — current cycle bills the active days only")
        .build());
    return when;
  }

  /**
   * End an assignment (lease end / move-out): close the window and release the
   * parking slot + WiFi account. Port of {@code endAssignment}.
   */
  @Transactional
  public Instant endAssignment(AuthPrincipal user, String assignmentId, Instant at) {
    ServiceAssignment a = assignments.findByIdAndTenantId(assignmentId, TenantContext.get())
        .orElseThrow(() -> ApiException.notFound("Assignment not found"));
    LeasingQueryApi.LeaseInfo lease = leasingApi.get(a.getLeaseId());
    if (!Rbdc.can(user, "update", "M12", Rbdc.ResourceRef.property(lease.propertyId()))) {
      throw ApiException.forbidden("M12", "update");
    }
    return endAssignmentInternal(a, at != null ? at : Instant.now());
  }

  /** Shared end-effect used by the controller and the lease-end SPI hook. */
  Instant endAssignmentInternal(ServiceAssignment a, Instant at) {
    if ("ended".equals(a.getStatus())) {
      throw new ApiException(422, "INVALID_TRANSITION", "Assignment already ended");
    }
    a.end(at);
    assignments.save(a);
    if (a.getSnapshotId() != null) leasingApi.closeServiceSnapshot(a.getSnapshotId(), at);
    if (a.getParkingSlotId() != null) {
      parkingSlots.findById(a.getParkingSlotId())
          .ifPresent(s -> { s.setStatus("free"); parkingSlots.save(s); });
    }
    if (a.getWifiAccountId() != null) {
      wifiAccounts.findById(a.getWifiAccountId())
          .ifPresent(w -> { w.setStatus("free"); wifiAccounts.save(w); });
    }
    return at;
  }

  /** Lease-end hook (via the leasing {@code ServiceReleasePort}). */
  @Transactional
  public int endAssignmentsForLease(String leaseId, Instant at) {
    String tenantId = TenantContext.get();
    List<ServiceAssignment> live = assignments.findByLeaseIdAndStatusInAndTenantId(
        leaseId, List.of("active", "suspended"), tenantId);
    for (ServiceAssignment a : live) endAssignmentInternal(a, at);
    return live.size();
  }

  // ---- per-use usages ------------------------------------------------------

  public record UsageResult(String usageId, int amountMinor) {}

  public record UsageView(String id, String serviceName, String leaseCode, int qtyMilli,
      String unitLabel, int amountMinor, Instant usedAt, String status) {}

  @Transactional(readOnly = true)
  public List<UsageView> listUsages(AuthPrincipal user) {
    String tenantId = TenantContext.get();
    String scope = Rbdc.widestScope(user, "read", "M12");
    if (scope == null) throw ApiException.forbidden("M12", "read");
    List<UsageView> out = new ArrayList<>();
    for (ServiceUsage u : usages.findByTenantIdOrderByUsedAtDesc(tenantId)) {
      LeasingQueryApi.LeaseInfo lease = safeLease(u.getLeaseId());
      if (lease == null) continue;
      if (!"GLOBAL".equals(scope) && !user.propertyIds().contains(lease.propertyId())) continue;
      ServiceCatalog svc = catalog.findByIdAndTenantId(u.getServiceId(), tenantId).orElse(null);
      out.add(new UsageView(u.getId(), svc != null ? svc.getName() : null, lease.code(),
          u.getQtyMilli(), u.getUnitLabel(), u.amountMinor(), u.getUsedAt(), u.getStatus()));
    }
    return out;
  }

  /**
   * Record a per-use entry on an active lease — rides the next invoice as a
   * one-time {@code service} line. Only per_use services accept usage. Port of
   * {@code recordUsage}.
   */
  @Transactional
  public UsageResult recordUsage(AuthPrincipal user, RecordUsageRequest req) {
    String tenantId = TenantContext.get();
    LeasingQueryApi.LeaseInfo lease = leasingApi.get(req.leaseId());
    if (!Rbdc.can(user, "create", "M12", Rbdc.ResourceRef.property(lease.propertyId()))) {
      throw ApiException.forbidden("M12", "create");
    }
    if (!"active".equals(lease.status())) {
      throw new ApiException(422, "LEASE_NOT_ACTIVE",
          "Usages can only be recorded on an active lease");
    }
    ServiceCatalog service = catalog.findByIdAndTenantId(req.serviceId(), tenantId)
        .filter(ServiceCatalog::isActive)
        .orElseThrow(() -> ApiException.notFound("Catalog service not found or inactive"));
    if (!"per_use".equals(service.getPricingModel())) {
      throw new ApiException(422, "INVALID_PRICING", service.getName() + " is "
          + service.getPricingModel() + " — per-use entries apply to per_use services");
    }
    int qtyMilli;
    try {
      qtyMilli = ServiceRules.toMilli(req.qty());
    } catch (Exception e) {
      throw new ApiException(422, "INVALID_QTY", "qty must be a positive number (up to 3 decimals)");
    }
    if (qtyMilli <= 0) throw new ApiException(422, "INVALID_QTY", "qty must be positive");

    Instant usedAt = req.usedAt() != null ? req.usedAt() : Instant.now();
    ServiceUsage usage = new ServiceUsage(service.getId(), req.leaseId(), qtyMilli,
        service.getUnitLabel(), service.getUnitPriceMinor(), usedAt, req.note(), user.id(), tenantId);
    usages.save(usage);
    int amountMinor = usage.amountMinor();
    audit.log(AuditEntry.builder()
        .actorId(user.id()).actorName(user.name())
        .module("M12").action("service.usage_recorded").entityType("service_usage")
        .entityId(usage.getId())
        .summary(service.getName() + " usage " + ServiceRules.formatMilli(qtyMilli) + " "
            + (service.getUnitLabel() != null ? service.getUnitLabel() : "unit") + " for "
            + lease.code() + " — " + String.format("%.2f", amountMinor / 100.0) + " on next invoice")
        .build());
    return new UsageResult(usage.getId(), amountMinor);
  }

  private LeasingQueryApi.LeaseInfo safeLease(String leaseId) {
    try {
      return leasingApi.get(leaseId);
    } catch (ApiException e) {
      return null;
    }
  }
}
