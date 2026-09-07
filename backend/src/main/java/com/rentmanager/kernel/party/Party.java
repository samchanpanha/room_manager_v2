package com.rentmanager.kernel.party;

import com.rentmanager.kernel.Cuid;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.Instant;

/**
 * Party (INTENT.md M00): one table reused for owners, members, vendors and staff
 * contacts. Bound to the existing Prisma {@code Party} table.
 */
@Entity
@Table(name = "Party")
public class Party {

  @Id
  @Column(name = "id")
  private String id = Cuid.generate();

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
  private Instant createdAt = Instant.now();

  @Column(name = "tenantId", nullable = false)
  private String tenantId;

  protected Party() {}

  public Party(String type, String name, String email, String phone, String tenantId) {
    this.type = type;
    this.name = name;
    this.email = email;
    this.phone = phone;
    this.tenantId = tenantId;
  }

  public String getId() { return id; }
  public String getType() { return type; }
  public String getName() { return name; }
  public void setName(String name) { this.name = name; }
  public String getEmail() { return email; }
  public void setEmail(String email) { this.email = email; }
  public String getPhone() { return phone; }
  public void setPhone(String phone) { this.phone = phone; }
  public Instant getCreatedAt() { return createdAt; }
  public String getTenantId() { return tenantId; }
}
