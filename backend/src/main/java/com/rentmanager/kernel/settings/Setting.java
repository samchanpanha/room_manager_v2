package com.rentmanager.kernel.settings;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.Instant;

/**
 * M28 settings row — non-secret config stored as a JSON string under a group key
 * (e.g. {@code m28.billing}). Bound to the existing Prisma {@code Setting} table.
 * Global to the deployment (single-tenant install today); the JSON blob keeps
 * the shape identical to the Next app so both stacks read the same values.
 */
@Entity
@Table(name = "Setting")
public class Setting {

  @Id @Column(name = "key")
  private String key;

  @Column(name = "value", nullable = false)
  private String value; // JSON string

  @Column(name = "updatedBy")
  private String updatedBy;

  @Column(name = "updatedAt", nullable = false)
  private Instant updatedAt = Instant.now();

  protected Setting() {}

  public String getKey() { return key; }
  public String getValue() { return value; }
}
