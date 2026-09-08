package com.rentmanager.kernel.tenant;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.Instant;

/** A SaaS tenant (organization). Backs the {@code Tenant} table (V2 migration). */
@Entity
@Table(name = "Tenant")
public class Tenant {

  @Id
  @Column(name = "id")
  private String id;

  @Column(name = "slug", nullable = false, unique = true)
  private String slug;

  @Column(name = "name", nullable = false)
  private String name;

  @Column(name = "status", nullable = false)
  private String status = "active";

  @Column(name = "createdAt", nullable = false)
  private Instant createdAt = Instant.now();

  protected Tenant() {}

  public Tenant(String id, String slug, String name) {
    this.id = id;
    this.slug = slug;
    this.name = name;
  }

  public String getId() { return id; }
  public String getSlug() { return slug; }
  public String getName() { return name; }
  public String getStatus() { return status; }
  public Instant getCreatedAt() { return createdAt; }
}
