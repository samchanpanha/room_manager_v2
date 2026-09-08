package com.rentmanager.utilities.domain;

import com.rentmanager.kernel.Cuid;
import jakarta.persistence.*;
import java.time.Instant;

/** Meter reading (INTENT.md M11). Bound to Prisma {@code MeterReading}. */
@Entity
@Table(name = "MeterReading")
public class MeterReading {

  @Id @Column(name = "id")
  private String id = Cuid.generate();

  @Column(name = "meterId", nullable = false)
  private String meterId;

  @Column(name = "valueMilli", nullable = false)
  private int valueMilli;

  @Column(name = "readAt", nullable = false)
  private Instant readAt;

  @Column(name = "estimated", nullable = false)
  private boolean estimated = false;

  @Column(name = "source", nullable = false)
  private String source = "manual"; // manual | csv | estimate

  @Column(name = "note")
  private String note;

  @Column(name = "createdById")
  private String createdById;

  @Column(name = "createdAt", nullable = false)
  private Instant createdAt = Instant.now();

  @Column(name = "tenantId", nullable = false)
  private String tenantId;

  protected MeterReading() {}

  public MeterReading(String meterId, int valueMilli, Instant readAt, boolean estimated,
      String source, String note, String createdById, String tenantId) {
    this.meterId = meterId;
    this.valueMilli = valueMilli;
    this.readAt = readAt;
    this.estimated = estimated;
    this.source = source;
    this.note = note;
    this.createdById = createdById;
    this.tenantId = tenantId;
  }

  public String getId() { return id; }
  public String getMeterId() { return meterId; }
  public int getValueMilli() { return valueMilli; }
  public Instant getReadAt() { return readAt; }
  public boolean isEstimated() { return estimated; }
  public String getSource() { return source; }
  public String getNote() { return note; }
}
