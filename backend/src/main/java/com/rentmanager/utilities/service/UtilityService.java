package com.rentmanager.utilities.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.rentmanager.kernel.audit.AuditEntry;
import com.rentmanager.kernel.audit.AuditService;
import com.rentmanager.kernel.tenant.TenantContext;
import com.rentmanager.leasing.LeasingQueryApi;
import com.rentmanager.platform.security.AuthPrincipal;
import com.rentmanager.platform.security.Rbdc;
import com.rentmanager.platform.web.ApiException;
import com.rentmanager.properties.RoomAccessApi;
import com.rentmanager.utilities.domain.*;
import com.rentmanager.utilities.dto.*;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Optional;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Utilities application service (INTENT.md M11) — a faithful port of
 * {@code src/lib/utilities/service.ts}. Owns meters, readings (manual /
 * estimate / CSV), tariff resolution and charge computation. Computed charges
 * are {@code pending} until the billing engine (M06) folds them into the
 * lease's next invoice via {@link com.rentmanager.billing.spi.UtilityBillingPort};
 * voiding that invoice reverts them. Enforces RBDC module {@code M11}, scoping
 * by the meter's room→property.
 */
@Service
public class UtilityService {

  private final UtilityRepositories.Meters meters;
  private final UtilityRepositories.Readings readings;
  private final UtilityRepositories.Tariffs tariffs;
  private final UtilityRepositories.Charges charges;
  private final RoomAccessApi roomsApi;
  private final LeasingQueryApi leasingApi;
  private final AuditService audit;

  public UtilityService(UtilityRepositories.Meters meters, UtilityRepositories.Readings readings,
      UtilityRepositories.Tariffs tariffs, UtilityRepositories.Charges charges,
      RoomAccessApi roomsApi, LeasingQueryApi leasingApi, AuditService audit) {
    this.meters = meters;
    this.readings = readings;
    this.tariffs = tariffs;
    this.charges = charges;
    this.roomsApi = roomsApi;
    this.leasingApi = leasingApi;
    this.audit = audit;
  }

  // ---- meters --------------------------------------------------------------

  public record MeterSummary(String id, String code, String type, String unitLabel,
      String roomId, String roomNumber, String propertyId, boolean active,
      String latestReading, Instant latestReadAt) {}

  /** List meters visible to the user (M11 read), scoped by room→property. */
  @Transactional(readOnly = true)
  public List<MeterSummary> list(AuthPrincipal user, String roomId) {
    String tenantId = TenantContext.get();
    String scope = Rbdc.widestScope(user, "read", "M11");
    if (scope == null) throw ApiException.forbidden("M11", "read");
    List<Meter> rows = meters.findByTenantIdOrderByCreatedAtDesc(tenantId);
    List<MeterSummary> out = new ArrayList<>();
    for (Meter m : rows) {
      if (roomId != null && !roomId.equals(m.getRoomId())) continue;
      RoomAccessApi.RoomInfo room = roomsApi.getRoom(m.getRoomId());
      if (!"GLOBAL".equals(scope) && !user.propertyIds().contains(room.propertyId())) continue;
      Optional<MeterReading> latest =
          readings.findFirstByMeterIdAndTenantIdOrderByReadAtDesc(m.getId(), tenantId);
      out.add(new MeterSummary(m.getId(), m.getCode(), m.getType(), m.getUnitLabel(),
          m.getRoomId(), room.number(), room.propertyId(), m.isActive(),
          latest.map(r -> UtilityRules.formatMilli(r.getValueMilli())).orElse(null),
          latest.map(MeterReading::getReadAt).orElse(null)));
    }
    return out;
  }

  /** Create a meter bound to a room (M11 create), scoped by the room's property. */
  @Transactional
  public String createMeter(AuthPrincipal user, CreateMeterRequest req) {
    String tenantId = TenantContext.get();
    if (!UtilityRules.isMeterType(req.type())) {
      throw ApiException.validation("Meter type must be elec, water or gas");
    }
    RoomAccessApi.RoomInfo room = roomsApi.getRoom(req.roomId());
    if (!Rbdc.can(user, "create", "M11", Rbdc.ResourceRef.property(room.propertyId()))) {
      throw ApiException.forbidden("M11", "create");
    }
    if (meters.existsByCodeAndTenantId(req.code(), tenantId)) {
      throw ApiException.duplicate("Meter code " + req.code() + " already exists");
    }
    String unitLabel = req.unitLabel() != null && !req.unitLabel().isBlank()
        ? req.unitLabel() : ("water".equals(req.type()) ? "m³" : "kWh");
    Meter meter = new Meter(req.code(), req.type(), unitLabel, room.id(), tenantId);
    meters.save(meter);
    audit.log(AuditEntry.builder()
        .actorId(user.id()).actorName(user.name())
        .module("M11").action("meter.created").entityType("meter").entityId(meter.getId())
        .summary("Meter " + meter.getCode() + " (" + req.type() + ") registered for room "
            + room.number())
        .build());
    return meter.getId();
  }

  // ---- tariffs -------------------------------------------------------------

  /**
   * Latest applicable tariff for a utility type at a moment: active, effective
   * on-or-before {@code at}; a property-specific tariff beats the org default,
   * then the most recent {@code effectiveFrom}. Port of {@code pickTariff}.
   */
  @Transactional(readOnly = true)
  public Optional<Tariff> resolveTariff(String utilityType, String propertyId, Instant at) {
    List<Tariff> candidates =
        tariffs.findByUtilityTypeAndActiveTrueAndTenantId(utilityType, TenantContext.get());
    return candidates.stream()
        .filter(t -> !t.getEffectiveFrom().isAfter(at))
        .filter(t -> t.getPropertyId() == null || t.getPropertyId().equals(propertyId))
        .max(Comparator
            .comparing((Tariff t) -> t.getPropertyId() != null && t.getPropertyId().equals(propertyId))
            .thenComparing(Tariff::getEffectiveFrom));
  }

  public record TariffView(String id, String utilityType, String name, String propertyId,
      int unitRateMinor, JsonNode tiers, Instant effectiveFrom, boolean active) {}

  @Transactional(readOnly = true)
  public List<TariffView> listTariffs(AuthPrincipal user) {
    if (!Rbdc.hasModuleAccess(user, "read", "M11")) throw ApiException.forbidden("M11", "read");
    return tariffs.findByTenantIdOrderByEffectiveFromDesc(TenantContext.get()).stream()
        .map(t -> new TariffView(t.getId(), t.getUtilityType(), t.getName(), t.getPropertyId(),
            t.getUnitRateMinor(), t.getTiers(), t.getEffectiveFrom(), t.isActive()))
        .toList();
  }

  /** Create a tariff (M11 create). Null propertyId = org default ⇒ GLOBAL grant. */
  @Transactional
  public String createTariff(AuthPrincipal user, CreateTariffRequest req) {
    String tenantId = TenantContext.get();
    if (!UtilityRules.isMeterType(req.utilityType())) {
      throw ApiException.validation("Tariff type must be elec, water or gas");
    }
    if (req.unitRateMinor() == null || req.unitRateMinor() < 0) {
      throw ApiException.validation("unitRateMinor must be a non-negative integer (minor per unit)");
    }
    Rbdc.ResourceRef ref = req.propertyId() == null
        ? Rbdc.ResourceRef.none() : Rbdc.ResourceRef.property(req.propertyId());
    // Org-wide default tariffs require a GLOBAL grant; property tariffs accept
    // a PROPERTY grant on that property.
    boolean ok = req.propertyId() == null
        ? Rbdc.can(user, "create", "M11")
        : Rbdc.can(user, "create", "M11", ref);
    if (!ok) throw ApiException.forbidden("M11", "create");

    JsonNode tiersNode = validateTiers(req.tiers());
    Instant effectiveFrom = req.effectiveFrom() != null ? req.effectiveFrom() : Instant.now();
    Tariff tariff = new Tariff(req.utilityType(), req.name(), req.propertyId(),
        req.unitRateMinor(), tiersNode, effectiveFrom, tenantId);
    tariffs.save(tariff);
    audit.log(AuditEntry.builder()
        .actorId(user.id()).actorName(user.name())
        .module("M11").action("tariff.created").entityType("tariff").entityId(tariff.getId())
        .summary("Tariff \"" + req.name() + "\" (" + req.utilityType() + ") created — "
            + String.format("%.2f", req.unitRateMinor() / 100.0) + " per unit, effective "
            + effectiveFrom.atZone(ZoneOffset.UTC).toLocalDate())
        .build());
    return tariff.getId();
  }

  /** Validate an optional tiers payload (throws on malformed) and return it unchanged. */
  private JsonNode validateTiers(JsonNode tiers) {
    if (tiers == null || tiers.isNull()) return null;
    if (!tiers.isArray()) {
      throw ApiException.validation("tiers must be an array of { upToMilli, ratePerUnitMinor }");
    }
    // Round-trip through the pricing rule to reject malformed / non-terminating tiers.
    UtilityRules.tieredChargeMinor(1, 0, parseTiers(tiers));
    return tiers;
  }

  private List<UtilityRules.TariffTier> parseTiers(JsonNode arr) {
    if (arr == null || arr.isNull()) return null;
    try {
      List<UtilityRules.TariffTier> out = new ArrayList<>();
      for (JsonNode n : arr) {
        Integer upTo = n.hasNonNull("upToMilli") ? n.get("upToMilli").asInt() : null;
        int rate = n.get("ratePerUnitMinor").asInt();
        out.add(new UtilityRules.TariffTier(upTo, rate));
      }
      return out;
    } catch (Exception e) {
      throw ApiException.validation("tiers must be an array of { upToMilli, ratePerUnitMinor }");
    }
  }

  // ---- readings ------------------------------------------------------------

  public record ReadingResult(String readingId, int valueMilli, int consumptionMilli,
      boolean estimated, String chargeId, Integer chargeMinor, boolean anomaly,
      List<String> warnings) {}

  /**
   * Record a reading (manual or estimated), compute consumption = reading −
   * previous, price it with the effective tariff and, when the room has an
   * active lease, create a pending {@link UtilityCharge}. The first reading is a
   * baseline (no charge). Port of {@code recordReading}.
   */
  @Transactional
  public ReadingResult recordReading(AuthPrincipal user, String meterId, RecordReadingRequest req) {
    String tenantId = TenantContext.get();
    Meter meter = meters.findByIdAndTenantId(meterId, tenantId)
        .filter(Meter::isActive)
        .orElseThrow(() -> ApiException.notFound("Meter not found"));
    RoomAccessApi.RoomInfo room = roomsApi.getRoom(meter.getRoomId());
    if (!Rbdc.can(user, "create", "M11", Rbdc.ResourceRef.property(room.propertyId()))) {
      throw ApiException.forbidden("M11", "create");
    }

    Instant readAt = req.readAt() != null ? req.readAt() : Instant.now();
    Optional<MeterReading> previousOpt =
        readings.findFirstByMeterIdAndTenantIdOrderByReadAtDesc(meterId, tenantId);
    MeterReading previous = previousOpt.orElse(null);
    if (previous != null && !readAt.isAfter(previous.getReadAt())) {
      throw new ApiException(422, "READING_ORDER",
          "readAt must be after the latest existing reading");
    }

    int valueMilli;
    boolean estimated = false;
    List<String> warnings = new ArrayList<>();
    boolean fromCsv = req.note() != null && req.note().startsWith("csv:");
    if (Boolean.TRUE.equals(req.estimate())) {
      List<MeterReading> history = readings.findByMeterIdAndTenantIdOrderByReadAtDesc(meterId, tenantId);
      if (history.size() < 3) {
        throw new ApiException(422, "NOT_ENOUGH_HISTORY",
            "Estimates need at least 3 prior readings (§M11 average of last 3)");
      }
      valueMilli = UtilityRules.estimateFromHistory(
          history.stream().limit(3).map(MeterReading::getValueMilli).toList());
      estimated = true;
      warnings.add("Estimated reading — average of last 3");
    } else {
      String valueText = req.valueText();
      if (valueText == null) {
        throw ApiException.validation("A reading value is required");
      }
      valueMilli = UtilityRules.toMilli(valueText);
      if (previous != null && valueMilli < previous.getValueMilli()) {
        throw new ApiException(422, "INVALID_READING",
            "Reading is below the latest (" + UtilityRules.formatMilli(previous.getValueMilli())
                + " " + meter.getUnitLabel() + ") — meters only move forward");
      }
    }

    int consumptionMilli = previous != null ? valueMilli - previous.getValueMilli() : 0;
    UtilityRules.Spike spike = UtilityRules.detectSpike(consumptionMilli, priorConsumptions(meterId));
    if (spike.anomaly()) {
      warnings.add("Spike: consumption is more than 2× the recent average ("
          + UtilityRules.formatMilli(spike.averageMilli() == null ? 0 : spike.averageMilli())
          + " " + meter.getUnitLabel() + ")");
    }

    LeasingQueryApi.LeaseInfo activeLease = leasingApi.activeLeaseForRoom(meter.getRoomId());

    MeterReading reading = new MeterReading(meterId, valueMilli, readAt, estimated,
        estimated ? "estimate" : fromCsv ? "csv" : "manual", req.note(), user.id(), tenantId);
    readings.save(reading);

    String chargeId = null;
    Integer chargeMinor = null;
    if (activeLease != null && previous != null && consumptionMilli > 0) {
      Optional<Tariff> tariff = resolveTariff(meter.getType(), room.propertyId(), readAt);
      if (tariff.isPresent()) {
        int amountMinor = UtilityRules.tieredChargeMinor(consumptionMilli,
            tariff.get().getUnitRateMinor(), parseTiers(tariff.get().getTiers()));
        UtilityCharge charge = new UtilityCharge(activeLease.id(), meter.getRoomId(), meterId,
            reading.getId(), previous.getReadAt(), readAt, consumptionMilli, amountMinor,
            tariff.get().getName(), spike.anomaly(),
            spike.anomaly() ? "Spike: > 2× recent average ("
                + UtilityRules.formatMilli(spike.averageMilli() == null ? 0 : spike.averageMilli())
                + ")" : null,
            tenantId);
        charges.save(charge);
        chargeId = charge.getId();
        chargeMinor = amountMinor;
      } else {
        warnings.add("No tariff configured for this meter type — reading stored without a charge");
      }
    }
    if (activeLease == null && consumptionMilli > 0) {
      warnings.add("Room has no active lease — reading stored without a charge");
    }

    audit.log(AuditEntry.builder()
        .actorId(user.id()).actorName(user.name())
        .module("M11").action("reading.recorded").entityType("meter_reading")
        .entityId(reading.getId())
        .summary("Reading " + UtilityRules.formatMilli(valueMilli) + " " + meter.getUnitLabel()
            + " on " + meter.getCode() + " (" + room.number() + ")"
            + (estimated ? " [estimated]" : "") + " — consumption "
            + UtilityRules.formatMilli(consumptionMilli)
            + (chargeMinor != null ? ", charge " + String.format("%.2f", chargeMinor / 100.0) : "")
            + (spike.anomaly() ? " ⚠ SPIKE" : ""))
        .build());

    return new ReadingResult(reading.getId(), valueMilli, consumptionMilli, estimated,
        chargeId, chargeMinor, spike.anomaly(), warnings);
  }

  /** Consumptions (gaps) of the last readings on a meter, newest first. */
  private List<Integer> priorConsumptions(String meterId) {
    List<MeterReading> rows =
        readings.findByMeterIdAndTenantIdOrderByReadAtDesc(meterId, TenantContext.get());
    if (rows.size() > 7) rows = rows.subList(0, 7);
    List<Integer> gaps = new ArrayList<>();
    for (int i = 0; i < rows.size() - 1; i++) {
      int gap = rows.get(i).getValueMilli() - rows.get(i + 1).getValueMilli();
      if (gap >= 0) gaps.add(gap);
    }
    return gaps;
  }

  public record ImportResult(int imported, List<Skip> skipped) {
    public record Skip(int line, String reason) {}
  }

  /** CSV import (§M11): rows {@code YYYY-MM-DD,value[,note]} in display units. */
  @Transactional
  public ImportResult importReadingsCsv(AuthPrincipal user, String meterId, String csv) {
    String tenantId = TenantContext.get();
    Meter meter = meters.findByIdAndTenantId(meterId, tenantId)
        .filter(Meter::isActive)
        .orElseThrow(() -> ApiException.notFound("Meter not found"));
    RoomAccessApi.RoomInfo room = roomsApi.getRoom(meter.getRoomId());
    if (!Rbdc.can(user, "create", "M11", Rbdc.ResourceRef.property(room.propertyId()))) {
      throw ApiException.forbidden("M11", "create");
    }
    List<String> lines = csv.lines().map(String::trim).filter(l -> !l.isEmpty()).toList();
    List<ImportResult.Skip> skipped = new ArrayList<>();
    int imported = 0;
    for (int i = 0; i < lines.size(); i++) {
      int lineNo = i + 1;
      String[] parts = lines.get(i).split(",");
      for (int j = 0; j < parts.length; j++) parts[j] = parts[j].trim();
      if (parts.length < 2) {
        skipped.add(new ImportResult.Skip(lineNo, "expected date,value[,note]"));
        continue;
      }
      Instant readAt;
      try {
        readAt = LocalDate.parse(parts[0]).atStartOfDay(ZoneOffset.UTC).toInstant();
      } catch (Exception e) {
        skipped.add(new ImportResult.Skip(lineNo, "invalid date"));
        continue;
      }
      String value;
      try {
        UtilityRules.toMilli(parts[1]);
        value = parts[1];
      } catch (Exception e) {
        skipped.add(new ImportResult.Skip(lineNo, "invalid value"));
        continue;
      }
      String note = ("csv: " + (parts.length > 2 ? parts[2] : "")).trim();
      try {
        recordReading(user, meterId, new RecordReadingRequest(
            com.fasterxml.jackson.databind.node.TextNode.valueOf(value), false, readAt, note));
        imported++;
      } catch (ApiException e) {
        skipped.add(new ImportResult.Skip(lineNo, e.getMessage()));
      }
    }
    audit.log(AuditEntry.builder()
        .actorId(user.id()).actorName(user.name())
        .module("M11").action("readings.imported").entityType("meter").entityId(meterId)
        .summary("CSV import on " + meter.getCode() + ": " + imported + " imported, "
            + skipped.size() + " skipped")
        .build());
    return new ImportResult(imported, skipped);
  }

  // ---- meter detail --------------------------------------------------------

  public record ReadingView(String id, int valueMilli, String value, Instant readAt,
      boolean estimated, String source, String note) {}

  public record MeterDetail(String id, String code, String type, String unitLabel,
      String roomId, String roomNumber, String propertyId, boolean active,
      List<ReadingView> readings) {}

  /** Meter detail + reading history for the chart (M11 read). */
  @Transactional(readOnly = true)
  public MeterDetail getMeter(AuthPrincipal user, String meterId) {
    String tenantId = TenantContext.get();
    Meter meter = meters.findByIdAndTenantId(meterId, tenantId)
        .orElseThrow(() -> ApiException.notFound("Meter not found"));
    RoomAccessApi.RoomInfo room = roomsApi.getRoom(meter.getRoomId());
    if (!Rbdc.can(user, "read", "M11", Rbdc.ResourceRef.property(room.propertyId()))) {
      throw ApiException.forbidden("M11", "read");
    }
    List<ReadingView> history =
        readings.findByMeterIdAndTenantIdOrderByReadAtDesc(meterId, tenantId).stream()
            .map(r -> new ReadingView(r.getId(), r.getValueMilli(),
                UtilityRules.formatMilli(r.getValueMilli()), r.getReadAt(), r.isEstimated(),
                r.getSource(), r.getNote()))
            .toList();
    return new MeterDetail(meter.getId(), meter.getCode(), meter.getType(), meter.getUnitLabel(),
        meter.getRoomId(), room.number(), room.propertyId(), meter.isActive(), history);
  }
}
