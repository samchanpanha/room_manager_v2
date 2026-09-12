package com.rentmanager.kernel.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

/**
 * A capability {@code module × action}. Bound to the Prisma
 * {@code Permission} table. The id is a natural key — {@code "${module}:${action}"}
 * (e.g. {@code M02:read}), per the RBDC catalog.
 */
@Entity
@Table(name = "Permission")
public class Permission {

  @Id
  @Column(name = "id")
  private String id;

  @Column(name = "module", nullable = false)
  private String module;

  @Column(name = "action", nullable = false)
  private String action;

  protected Permission() {}

  public String getId() { return id; }
  public String getModule() { return module; }
  public String getAction() { return action; }
}