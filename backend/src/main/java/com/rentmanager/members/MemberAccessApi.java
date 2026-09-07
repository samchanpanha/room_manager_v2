package com.rentmanager.members;

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

  public MemberAccessApi(MemberRepository members) {
    this.members = members;
  }

  /** Eligibility snapshot. */
  public record MemberInfo(String id, String status, boolean blacklisted, String name,
      String homePropertyId) {}

  @Transactional(readOnly = true)
  public MemberInfo get(String memberProfileId) {
    MemberProfile m = members.findByIdAndTenantId(memberProfileId, TenantContext.get())
        .orElseThrow(() -> ApiException.notFound("Member not found"));
    return new MemberInfo(m.getId(), m.getStatus(), m.isBlacklisted(), null, m.getHomePropertyId());
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
