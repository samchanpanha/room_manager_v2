package com.rentmanager.iam.domain;

import jakarta.persistence.*;

/** Join row granting a permission to a role at a scope. Bound to {@code RolePermission}. */
@Entity
@Table(name = "RolePermission")
@IdClass(RolePermissionId.class)
public class RolePermission {

  @Id
  @Column(name = "roleId")
  private String roleId;

  @Id
  @Column(name = "permissionId")
  private String permissionId;

  @Id
  @Column(name = "scope")
  private String scope; // GLOBAL | PROPERTY | OWN

  @ManyToOne(fetch = FetchType.EAGER)
  @JoinColumn(name = "permissionId", insertable = false, updatable = false)
  private Permission permission;

  protected RolePermission() {}

  public String getScope() { return scope; }
  public Permission getPermission() { return permission; }
}
