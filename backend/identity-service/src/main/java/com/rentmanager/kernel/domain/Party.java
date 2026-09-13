package com.rentmanager.kernel.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.Instant;

/**
 * Party (M00): one table reused for members, owners, vendors and staff
 * contacts. Bound to the Prisma {@code Party} table. Read-only for slice 1.
 */
@Entity
@Table(name = "Party")
public class Party {

  @Id
  @Column(name = "id")
  private String id;

  @Column(name = "tenantId", nullable = false)
  private String tenantId;

  /** PERSON | COMPANY */
  @Column(name = "type", nullable = false)
  private String type;

  @Column(name = "name", nullable = false)
  private String name;

  @Column(name = "email")
  private String email;

  @Column(name = "phone")
  private String phone;

  @Column(name = "createdAt", nullable = false)
  private Instant createdAt;

  protected Party() {}

  public String getId() { return id; }
  public String getTenantId() { return tenantId; }
  public String getType() { return type; }
  public String getName() { return name; }
  public String getEmail() { return email; }
  public String getPhone() { return phone; }
}