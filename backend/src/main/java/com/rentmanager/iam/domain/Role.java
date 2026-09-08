package com.rentmanager.iam.domain;

import com.rentmanager.kernel.Cuid;
import jakarta.persistence.*;
import java.time.Instant;
import java.util.HashSet;
import java.util.Set;

/** Dynamic role (INTENT.md M01). Bound to Prisma {@code Role}. */
@Entity
@Table(name = "Role")
public class Role {

  @Id
  @Column(name = "id")
  private String id = Cuid.generate();

  @Column(name = "key", nullable = false, unique = true)
  private String key;

  @Column(name = "name", nullable = false)
  private String name;

  @Column(name = "description")
  private String description;

  @Column(name = "isSystem", nullable = false)
  private boolean system = false;

  @Column(name = "isProtected", nullable = false)
  private boolean isProtected = false;

  @Column(name = "createdAt", nullable = false)
  private Instant createdAt = Instant.now();

  @Column(name = "tenantId", nullable = false)
  private String tenantId;

  @OneToMany(fetch = FetchType.EAGER)
  @JoinColumn(name = "roleId")
  private Set<RolePermission> permissions = new HashSet<>();

  protected Role() {}

  public Role(String key, String name, String tenantId) {
    this.key = key;
    this.name = name;
    this.tenantId = tenantId;
  }

  public String getId() { return id; }
  public String getKey() { return key; }
  public String getName() { return name; }
  public boolean isProtected() { return isProtected; }
  public Set<RolePermission> getPermissions() { return permissions; }
}
