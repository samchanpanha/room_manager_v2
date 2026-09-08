package com.rentmanager.inventory.domain;

import com.rentmanager.kernel.Cuid;
import jakarta.persistence.*;
import java.time.Instant;

/**
 * Supplier (INTENT.md M15) — global, name-unique (no tenant column in the Prisma
 * schema, so it stays shared across tenants, matching the Next app). Bound to
 * the existing Prisma {@code Supplier} table.
 */
@Entity
@Table(name = "Supplier")
public class Supplier {

  @Id @Column(name = "id")
  private String id = Cuid.generate();

  @Column(name = "name", nullable = false, unique = true)
  private String name;

  @Column(name = "phone")
  private String phone;

  @Column(name = "email")
  private String email;

  @Column(name = "notes")
  private String notes;

  @Column(name = "createdAt", nullable = false)
  private Instant createdAt = Instant.now();

  @Column(name = "updatedAt", nullable = false)
  private Instant updatedAt = Instant.now();

  @PreUpdate void touch() { this.updatedAt = Instant.now(); }

  protected Supplier() {}

  public Supplier(String name, String phone, String email, String notes) {
    this.name = name;
    this.phone = phone;
    this.email = email;
    this.notes = notes;
  }

  public String getId() { return id; }
  public String getName() { return name; }
  public String getPhone() { return phone; }
  public String getEmail() { return email; }
  public String getNotes() { return notes; }
}
