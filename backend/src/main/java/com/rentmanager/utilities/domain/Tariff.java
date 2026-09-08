package com.rentmanager.utilities.domain;

import com.fasterxml.jackson.databind.JsonNode;
import com.rentmanager.kernel.Cuid;
import jakarta.persistence.*;
import java.time.Instant;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

/**
 * Tariff (INTENT.md M11): price per unit with optional progressive tiers stored
 * as a JSON string ({@code [{upToMilli, ratePerUnitMinor}]}). Bound to Prisma
 * {@code Tariff}; a null propertyId is the organisation-wide default.
 */
@Entity
@Table(name = "Tariff")
public class Tariff {

  @Id @Column(name = "id")
  private String id = Cuid.generate();

  @Column(name = "utilityType", nullable = false)
  private String utilityType; // elec | water | gas

  @Column(name = "name", nullable = false)
  private String name;

  @Column(name = "propertyId")
  private String propertyId;

  @Column(name = "unitRateMinor", nullable = false)
  private int unitRateMinor;

  @JdbcTypeCode(SqlTypes.JSON)
  @Column(name = "tiers", columnDefinition = "jsonb")
  private JsonNode tiers; // JSON array [{upToMilli, ratePerUnitMinor}], or null

  @Column(name = "effectiveFrom", nullable = false)
  private Instant effectiveFrom;

  @Column(name = "isActive", nullable = false)
  private boolean active = true;

  @Column(name = "createdAt", nullable = false)
  private Instant createdAt = Instant.now();

  @Column(name = "tenantId", nullable = false)
  private String tenantId;

  protected Tariff() {}

  public Tariff(String utilityType, String name, String propertyId, int unitRateMinor,
      JsonNode tiers, Instant effectiveFrom, String tenantId) {
    this.utilityType = utilityType;
    this.name = name;
    this.propertyId = propertyId;
    this.unitRateMinor = unitRateMinor;
    this.tiers = tiers;
    this.effectiveFrom = effectiveFrom;
    this.tenantId = tenantId;
  }

  public String getId() { return id; }
  public String getUtilityType() { return utilityType; }
  public String getName() { return name; }
  public String getPropertyId() { return propertyId; }
  public int getUnitRateMinor() { return unitRateMinor; }
  public JsonNode getTiers() { return tiers; }
  public Instant getEffectiveFrom() { return effectiveFrom; }
  public boolean isActive() { return active; }
}
