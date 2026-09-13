package com.rentmanager.kernel.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import java.time.Instant;

/**
 * DB-backed, revocable session (INTENT.md M01). Bound to the Prisma
 * {@code Session} table. Read-only for slice 1.
 */
@Entity
@Table(name = "Session")
public class Session {

  @Id
  @Column(name = "id")
  private String id;

  @Column(name = "userId", nullable = false)
  private String userId;

  @Column(name = "tokenHash", nullable = false, unique = true)
  private String tokenHash;

  @Column(name = "userAgent")
  private String userAgent;

  @Column(name = "ip")
  private String ip;

  @Column(name = "createdAt", nullable = false)
  private Instant createdAt;

  @Column(name = "expiresAt", nullable = false)
  private Instant expiresAt;

  @Column(name = "revokedAt")
  private Instant revokedAt;

  @ManyToOne(fetch = FetchType.LAZY)
  @JoinColumn(name = "userId", insertable = false, updatable = false)
  private User user;

  protected Session() {}

  /** Creates a session row exactly as {@code prisma.session.create} does. */
  public Session(String id, String userId, String tokenHash,
      String userAgent, String ip, Instant createdAt, Instant expiresAt) {
    this.id = id;
    this.userId = userId;
    this.tokenHash = tokenHash;
    this.userAgent = userAgent;
    this.ip = ip;
    this.createdAt = createdAt;
    this.expiresAt = expiresAt;
  }

  public String getId() { return id; }
  public String getUserId() { return userId; }
  public String getTokenHash() { return tokenHash; }
  public Instant getExpiresAt() { return expiresAt; }
  public Instant getRevokedAt() { return revokedAt; }
  public User getUser() { return user; }
}