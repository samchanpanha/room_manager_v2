package com.rentmanager.kernel.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.Instant;

/**
 * Bound to the Prisma {@code AuditLog} table. Append-only by design; {@code
 * prevHash}/{@code hash} implement the M27 tamper-evident chain (see
 * {@code com.rentmanager.kernel.service.AuditService}, which recomputes the same
 * {@code rowHash} as src/lib/audit.ts). The {@code tenant}/{@code actor}
 * relations are intentionally not mapped — only the scalar row is written.
 */
@Entity
@Table(name = "AuditLog")
public class AuditLog {

  @Id
  @Column(name = "id")
  private String id;

  @Column(name = "tenantId", nullable = false)
  private String tenantId;

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

  @Column(name = "before", length = 1000)
  private String before;

  @Column(name = "after", length = 1000)
  private String after;

  @Column(name = "ip")
  private String ip;

  @Column(name = "prevHash")
  private String prevHash;

  @Column(name = "hash")
  private String hash;

  @Column(name = "createdAt", nullable = false)
  private Instant createdAt;

  protected AuditLog() {}

  public AuditLog(String id, String tenantId, String actorId, String actorName,
      String module, String action, String entityType, String entityId, String summary,
      String before, String after, String ip, String prevHash, String hash, Instant createdAt) {
    this.id = id;
    this.tenantId = tenantId;
    this.actorId = actorId;
    this.actorName = actorName;
    this.module = module;
    this.action = action;
    this.entityType = entityType;
    this.entityId = entityId;
    this.summary = summary;
    this.before = before;
    this.after = after;
    this.ip = ip;
    this.prevHash = prevHash;
    this.hash = hash;
    this.createdAt = createdAt;
  }

  public String getId() { return id; }
  public String getTenantId() { return tenantId; }
  public String getActorId() { return actorId; }
  public String getActorName() { return actorName; }
  public String getModule() { return module; }
  public String getAction() { return action; }
  public String getEntityType() { return entityType; }
  public String getEntityId() { return entityId; }
  public String getSummary() { return summary; }
  public String getBefore() { return before; }
  public String getAfter() { return after; }
  public String getIp() { return ip; }
  public String getPrevHash() { return prevHash; }
  public String getHash() { return hash; }
  public Instant getCreatedAt() { return createdAt; }
}