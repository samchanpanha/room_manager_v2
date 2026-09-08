package com.rentmanager.iam.domain;

import com.rentmanager.kernel.Cuid;
import jakarta.persistence.*;
import java.time.Instant;

/** DB-backed, revocable session (INTENT.md M01). Bound to Prisma {@code Session}. */
@Entity
@Table(name = "Session")
public class Session {

  @Id
  @Column(name = "id")
  private String id = Cuid.generate();

  @Column(name = "userId", nullable = false)
  private String userId;

  @Column(name = "tokenHash", nullable = false, unique = true)
  private String tokenHash;

  @Column(name = "userAgent")
  private String userAgent;

  @Column(name = "ip")
  private String ip;

  @Column(name = "createdAt", nullable = false)
  private Instant createdAt = Instant.now();

  @Column(name = "expiresAt", nullable = false)
  private Instant expiresAt;

  @Column(name = "revokedAt")
  private Instant revokedAt;

  protected Session() {}

  public Session(String userId, String tokenHash, Instant expiresAt, String userAgent, String ip) {
    this.userId = userId;
    this.tokenHash = tokenHash;
    this.expiresAt = expiresAt;
    this.userAgent = userAgent;
    this.ip = ip;
  }

  public String getId() { return id; }
  public String getUserId() { return userId; }
  public String getTokenHash() { return tokenHash; }
  public Instant getExpiresAt() { return expiresAt; }
  public Instant getRevokedAt() { return revokedAt; }
  public void revoke() { this.revokedAt = Instant.now(); }

  public boolean isActive() {
    return revokedAt == null && expiresAt.isAfter(Instant.now());
  }
}
