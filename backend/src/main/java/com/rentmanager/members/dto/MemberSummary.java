package com.rentmanager.members.dto;

import com.rentmanager.members.domain.MemberProfile;

/** List-row shape for GET /api/members. */
public record MemberSummary(
    String id,
    String status,
    boolean blacklisted,
    String homePropertyId,
    String nationality,
    String idNumber) {

  public static MemberSummary from(MemberProfile m) {
    return new MemberSummary(m.getId(), m.getStatus(), m.isBlacklisted(),
        m.getHomePropertyId(), m.getNationality(), m.getIdNumber());
  }
}
