package com.rentmanager.billing.domain;

import com.rentmanager.kernel.Cuid;
import jakarta.persistence.*;

/** Invoice line item (M07). Bound to Prisma {@code InvoiceItem}. */
@Entity
@Table(name = "InvoiceItem")
public class InvoiceItem {

  @Id @Column(name = "id")
  private String id = Cuid.generate();

  @Column(name = "invoiceId", nullable = false)
  private String invoiceId;

  @Column(name = "kind", nullable = false)
  private String kind; // rent|service|utility|one_time|late_fee|credit|deposit

  @Column(name = "name", nullable = false)
  private String name;

  @Column(name = "qty", nullable = false)
  private int qty = 1;

  @Column(name = "unitMinor", nullable = false)
  private int unitMinor;

  @Column(name = "amountMinor", nullable = false)
  private int amountMinor;

  @Column(name = "tenantId", nullable = false)
  private String tenantId;

  protected InvoiceItem() {}

  public InvoiceItem(String kind, String name, int qty, int unitMinor, String tenantId) {
    this.kind = kind;
    this.name = name;
    this.qty = qty;
    this.unitMinor = unitMinor;
    this.amountMinor = qty * unitMinor;
    this.tenantId = tenantId;
  }

  public String getId() { return id; }
  public String getKind() { return kind; }
  public String getName() { return name; }
  public int getQty() { return qty; }
  public int getUnitMinor() { return unitMinor; }
  public int getAmountMinor() { return amountMinor; }
}
