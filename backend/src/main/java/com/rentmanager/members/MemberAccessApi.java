package com.rentmanager.members;

import com.rentmanager.kernel.party.Party;
import com.rentmanager.kernel.party.PartyRepository;
import com.rentmanager.kernel.tenant.TenantContext;
import com.rentmanager.members.domain.MemberProfile;
import com.rentmanager.members.domain.MemberRepository;
import com.rentmanager.platform.web.ApiException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Published API of the members module for other modules that need to read a
 * member's eligibility and drive its lifecycle status (e.g. leasing M05 flips
 * verified→active on activation and →moved_out on the last lease ending).
 */
@Service
public class MemberAccessApi {

  private final MemberRepository members;
  private final PartyRepository parties;

  public MemberAccessApi(MemberRepository members, PartyRepository parties) {
    this.members = members;
    this.parties = parties;
  }

  /** Eligibility snapshot. */
  public record MemberInfo(String id, String status, boolean blacklisted, String name,
      String homePropertyId) {}

  /** Identity snapshot for ownership checks / statement headers. */
  public record MemberIdentity(String id, String partyId, String name) {}

  @Transactional(readOnly = true)
  public MemberInfo get(String memberProfileId) {
    MemberProfile m = members.findByIdAndTenantId(memberProfileId, TenantContext.get())
        .orElseThrow(() -> ApiException.notFound("Member not found"));
    Party party = parties.findById(m.getPartyId()).orElse(null);
    return new MemberInfo(m.getId(), m.getStatus(), m.isBlacklisted(),
        party == null ? null : party.getName(), m.getHomePropertyId());
  }

  /**
   * The member profile id owned by a party (the logged-in user's party), or
   * {@code null} when the party has no member profile. Used for ownership
   * checks on self-service endpoints (M13 pay-my-own-invoice, M02 read-my-QR).
   */
  @Transactional(readOnly = true)
  public String memberIdForParty(String partyId) {
    if (partyId == null) return null;
    return members.findByPartyIdAndTenantId(partyId, TenantContext.get())
        .map(MemberProfile::getId).orElse(null);
  }

  /** Resolve a member's party + display name (for statement access control). */
  @Transactional(readOnly = true)
  public MemberIdentity identity(String memberProfileId) {
    MemberProfile m = members.findByIdAndTenantId(memberProfileId, TenantContext.get())
        .orElseThrow(() -> ApiException.notFound("Member not found"));
    Party party = parties.findById(m.getPartyId()).orElse(null);
    return new MemberIdentity(m.getId(), m.getPartyId(), party == null ? null : party.getName());
  }

  /**
   * Like {@link #identity} but returns {@code null} instead of throwing when the
   * member does not exist — used by the public M13 poster flow, where a stale
   * token must yield a clean 404 rather than an error (mirrors the nullable
   * {@code memberDuesForToken} lookup in qrpay/service.ts).
   */
  @Transactional(readOnly = true)
  public MemberIdentity identityOrNull(String memberProfileId) {
    return members.findByIdAndTenantId(memberProfileId, TenantContext.get())
        .map(m -> {
          Party party = parties.findById(m.getPartyId()).orElse(null);
          return new MemberIdentity(m.getId(), m.getPartyId(), party == null ? null : party.getName());
        })
        .orElse(null);
  }

  /** Transition a member's status (used by lease activation / ending effects). */
  @Transactional
  public void setStatus(String memberProfileId, String toStatus) {
    MemberProfile m = members.findByIdAndTenantId(memberProfileId, TenantContext.get())
        .orElseThrow(() -> ApiException.notFound("Member not found"));
    m.setStatus(toStatus);
    members.save(m);
  }
}
