package com.rentmanager.iam.domain;

import jakarta.persistence.*;

/** Permission = module × action (INTENT.md §5). Bound to Prisma {@code Permission}. */
@Entity
@Table(name = "Permission")
public class Permission {

  @Id
  @Column(name = "id")
  private String id; // e.g. "M02:read"

  @Column(name = "module", nullable = false)
  private String module;

  @Column(name = "action", nullable = false)
  private String action;

  protected Permission() {}

  public String getId() { return id; }
  public String getModule() { return module; }
  public String getAction() { return action; }
}
