package com.rentmanager.members.dto;

import java.util.List;

/**
 * Response envelope for {@code GET /api/members} — JSON {@code {members:[…]}},
 * byte-for-byte wire parity with {@code src/app/api/members/route.ts}.
 */
public record MemberListResponse(List<MemberRow> members) {}