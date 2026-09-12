package com.rentmanager.kernel.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

/**
 * Room bound to the Prisma {@code Room} table. Read-only for slice 1; only the
 * {@code number} column used by the lease row shape is mapped.
 */
@Entity
@Table(name = "Room")
public class Room {

  @Id
  @Column(name = "id")
  private String id;

  @Column(name = "number", nullable = false)
  private String number;

  protected Room() {}

  public String getId() { return id; }
  public String getNumber() { return number; }
}