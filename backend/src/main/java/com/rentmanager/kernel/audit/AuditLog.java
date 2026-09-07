package com.rentmanager.kernel.audit;

import com.rentmanager.kernel.Cuid;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.Instant;

/** Tamper-evident audit trail (INTENT.md M27). Bound to Prisma {@code AuditLog}. */
@Entity
@Table(name = "AuditLog")
public class AuditLog {

  @Id
  @Column(name = "id")
  private String id = Cuid.generate();

  @Column(name = "actorId")
  private String actorId;

  @Column(name = "actorName", nullable = false)
  private String actorName;

  @Column(name = "module", nullable = false)
  private String module;

  @Column(name = "action", nullable = false)
  private String action;

  @Column(name = "entityType", nullable = false)
  private String entityType;

  @Column(name = "entityId")
  private String entityId;

  @Column(name = "summary", nullable = false)
  private String summary;

  @Column(name = "before")
  private String before;

  @Column(name = "after")
  private String after;

  @Column(name = "ip")
  private String ip;

  @Column(name = "prevHash")
  private String prevHash;

  @Column(name = "hash")
  private String hash;

  @Column(name = "createdAt", nullable = false)
  private Instant createdAt = Instant.now();

  @Column(name = "tenantId", nullable = false)
  private String tenantId;

  protected AuditLog() {}

  AuditLog(AuditEntry e, String tenantId, String prevHash, String hash) {
    this.actorId = e.actorId();
    this.actorName = e.actorName();
    this.module = e.module();
    this.action = e.action();
    this.entityType = e.entityType();
    this.entityId = e.entityId();
    this.summary = e.summary();
    this.before = e.before();
    this.after = e.after();
    this.ip = e.ip();
    this.tenantId = tenantId;
    this.prevHash = prevHash;
    this.hash = hash;
  }

  public String getId() { return id; }
  public String getHash() { return hash; }
  public Instant getCreatedAt() { return createdAt; }
}
