package com.rentmanager.kernel.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.Instant;

/**
 * Property bound to the Prisma {@code Property} table. Read-only for slice 1;
 * only the columns used by the members list are mapped ({@code code} powers
 * {@code propertyCode}).
 */
@Entity
@Table(name = "Property")
public class Property {

  @Id
  @Column(name = "id")
  private String id;

  @Column(name = "code", nullable = false, unique = true)
  private String code;

  @Column(name = "createdAt", nullable = false)
  private Instant createdAt;

  protected Property() {}

  public String getId() { return id; }
  public String getCode() { return code; }
}