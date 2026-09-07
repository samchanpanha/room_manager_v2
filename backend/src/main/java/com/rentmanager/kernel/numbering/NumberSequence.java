package com.rentmanager.kernel.numbering;

import jakarta.persistence.*;

/** Gapless per-key counter (INTENT.md M00). Bound to Prisma {@code NumberSequence}. */
@Entity
@Table(name = "NumberSequence")
public class NumberSequence {

  @Id @Column(name = "key")
  private String key;

  @Column(name = "value", nullable = false)
  private int value = 0;

  @Column(name = "tenantId", nullable = false)
  private String tenantId;

  protected NumberSequence() {}

  public NumberSequence(String key, int value, String tenantId) {
    this.key = key; this.value = value; this.tenantId = tenantId;
  }

  public String getKey() { return key; }
  public int getValue() { return value; }
  public void setValue(int v) { this.value = v; }
}
