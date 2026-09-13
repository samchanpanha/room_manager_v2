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
 * Tenant/resident profile (INTENT.md M02). Bound to the Prisma
 * {@code MemberProfile} table. Read-only for slice 1.
 *
 * <p>Note there is no {@code tenantId} on this table — tenant scoping goes
 * through the owning {@link Party} (the same way the Next query filters
 * {@code party.tenantId}). Both scalar FKs and their associations are mapped
 * ({@code partyId}/{@code homePropertyId} read-only via the join columns) so
 * the list query can join-fetch both relations.
 */
@Entity
@Table(name = "MemberProfile")
public class MemberProfile {

  @Id
  @Column(name = "id")
  private String id;

  @Column(name = "partyId", nullable = false, unique = true)
  private String partyId;

  /** prospect | verified | active | notice | moved_out */
  @Column(name = "status", nullable = false)
  private String status;

  @Column(name = "blacklisted", nullable = false)
  private boolean blacklisted;

  @Column(name = "blacklistReason")
  private String blacklistReason;

  @Column(name = "homePropertyId")
  private String homePropertyId;

  @Column(name = "nationality")
  private String nationality;

  @Column(name = "idNumber")
  private String idNumber;

  @Column(name = "createdAt", nullable = false)
  private Instant createdAt;

  @Column(name = "updatedAt", nullable = false)
  private Instant updatedAt;

  @ManyToOne(fetch = FetchType.LAZY)
  @JoinColumn(name = "partyId", insertable = false, updatable = false)
  private Party party;

  @ManyToOne(fetch = FetchType.LAZY)
  @JoinColumn(name = "homePropertyId", insertable = false, updatable = false)
  private Property homeProperty;

  protected MemberProfile() {}

  public String getId() { return id; }
  public String getPartyId() { return partyId; }
  public String getStatus() { return status; }
  public boolean isBlacklisted() { return blacklisted; }
  public String getBlacklistReason() { return blacklistReason; }
  public String getHomePropertyId() { return homePropertyId; }
  public String getNationality() { return nationality; }
  public String getIdNumber() { return idNumber; }
  public Party getParty() { return party; }
  public Property getHomeProperty() { return homeProperty; }
}