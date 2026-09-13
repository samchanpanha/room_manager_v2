package com.rentmanager.kernel.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.OneToMany;
import jakarta.persistence.Table;
import java.time.Instant;
import java.util.HashSet;
import java.util.Set;

/**
 * Dynamic role (INTENT.md M01). Bound to the Prisma {@code Role} table.
 * Read-only for slice 1.
 */
@Entity
@Table(name = "Role")
public class Role {

  @Id
  @Column(name = "id")
  private String id;

  /** SUPER_ADMIN, ADMIN, or slug for custom roles */
  @Column(name = "key", nullable = false, unique = true)
  private String key;

  @Column(name = "name", nullable = false)
  private String name;

  @Column(name = "description")
  private String description;

  @Column(name = "isSystem", nullable = false)
  private boolean system;

  @Column(name = "isProtected", nullable = false)
  private boolean isProtected;

  @Column(name = "createdAt", nullable = false)
  private Instant createdAt;

  @OneToMany(fetch = FetchType.LAZY)
  @JoinColumn(name = "roleId")
  private Set<RolePermission> permissions = new HashSet<>();

  protected Role() {}

  public String getId() { return id; }
  public String getKey() { return key; }
  public String getName() { return name; }
  public boolean isProtected() { return isProtected; }
  public Set<RolePermission> getPermissions() { return permissions; }
}