package com.rentmanager.inventory.pos.domain;

import com.rentmanager.kernel.Cuid;
import jakarta.persistence.*;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;

/**
 * One POS sale (INTENT.md M14): cash/qr/card settle immediately to the drawer;
 * {@code room_charge} posts the total to a member's account as a one-time
 * invoice. {@code code} is SAL-YYYY-NNNN. Bound to the Prisma {@code PosSale}.
 */
@Entity
@Table(name = "PosSale")
public class PosSale {

  @Id @Column(name = "id")
  private String id = Cuid.generate();

  @Column(name = "code", nullable = false, unique = true)
  private String code;

  @Column(name = "sessionId", nullable = false)
  private String sessionId;

  @Column(name = "propertyId", nullable = false)
  private String propertyId;

  @Column(name = "method", nullable = false)
  private String method; // cash | qr | card | room_charge

  @Column(name = "totalMinor", nullable = false)
  private int totalMinor; // gross line total

  @Column(name = "discountMinor", nullable = false)
  private int discountMinor = 0;

  @Column(name = "discountLabel")
  private String discountLabel;

  @Column(name = "memberProfileId")
  private String memberProfileId;

  @Column(name = "invoiceId", unique = true)
  private String invoiceId; // room_charge: the issued one-time invoice

  @Column(name = "ref")
  private String ref;

  @Column(name = "receiptDocId")
  private String receiptDocId;

  @Column(name = "soldById", nullable = false)
  private String soldById;

  @Column(name = "createdAt", nullable = false)
  private Instant createdAt = Instant.now();

  @Column(name = "tenantId", nullable = false)
  private String tenantId;

  @OneToMany(cascade = CascadeType.ALL, orphanRemoval = true, fetch = FetchType.EAGER)
  @JoinColumn(name = "saleId")
  private List<PosSaleItem> items = new ArrayList<>();

  protected PosSale() {}

  public PosSale(String code, String sessionId, String propertyId, String method, int totalMinor,
      String soldById, String tenantId) {
    this.code = code;
    this.sessionId = sessionId;
    this.propertyId = propertyId;
    this.method = method;
    this.totalMinor = totalMinor;
    this.soldById = soldById;
    this.tenantId = tenantId;
  }

  public String getId() { return id; }
  public String getCode() { return code; }
  public String getSessionId() { return sessionId; }
  public String getPropertyId() { return propertyId; }
  public String getMethod() { return method; }
  public int getTotalMinor() { return totalMinor; }
  public int getDiscountMinor() { return discountMinor; }
  public void setDiscountMinor(int v) { this.discountMinor = v; }
  public String getDiscountLabel() { return discountLabel; }
  public void setDiscountLabel(String v) { this.discountLabel = v; }
  public String getMemberProfileId() { return memberProfileId; }
  public void setMemberProfileId(String v) { this.memberProfileId = v; }
  public String getInvoiceId() { return invoiceId; }
  public void setInvoiceId(String v) { this.invoiceId = v; }
  public String getRef() { return ref; }
  public void setRef(String v) { this.ref = v; }
  public String getReceiptDocId() { return receiptDocId; }
  public void setReceiptDocId(String v) { this.receiptDocId = v; }
  public String getSoldById() { return soldById; }
  public Instant getCreatedAt() { return createdAt; }
  public String getTenantId() { return tenantId; }
  public List<PosSaleItem> getItems() { return items; }
}
