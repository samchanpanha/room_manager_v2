package com.rentmanager.finance.ledger.domain;

import com.rentmanager.kernel.Cuid;
import jakarta.persistence.*;

/**
 * Chart-of-accounts row (INTENT.md M08). Bound to the existing Prisma
 * {@code LedgerAccount} table. Shared system reference data — not tenant-scoped.
 */
@Entity
@Table(name = "LedgerAccount")
public class LedgerAccount {

  @Id @Column(name = "id")
  private String id = Cuid.generate();

  @Column(name = "code", nullable = false, unique = true)
  private String code;

  @Column(name = "name", nullable = false)
  private String name;

  @Column(name = "type", nullable = false)
  private String type; // ASSET|LIABILITY|INCOME|EXPENSE|EQUITY

  @Column(name = "isSystem", nullable = false)
  private boolean system = true;

  @Column(name = "isActive", nullable = false)
  private boolean active = true;

  protected LedgerAccount() {}

  public LedgerAccount(String code, String name, String type) {
    this.code = code;
    this.name = name;
    this.type = type;
  }

  public String getId() { return id; }
  public String getCode() { return code; }
  public String getName() { return name; }
  public String getType() { return type; }
  public boolean isSystem() { return system; }
  public boolean isActive() { return active; }
}
