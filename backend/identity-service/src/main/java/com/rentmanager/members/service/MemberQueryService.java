package com.rentmanager.members.service;

import com.rentmanager.kernel.domain.Lease;
import com.rentmanager.kernel.domain.LeaseRepository;
import com.rentmanager.kernel.domain.MemberProfile;
import com.rentmanager.kernel.domain.MemberProfileRepository;
import com.rentmanager.kernel.domain.Party;
import com.rentmanager.members.dto.LeaseRow;
import com.rentmanager.members.dto.MemberRow;
import com.rentmanager.members.dto.PartyView;
import com.rentmanager.members.dto.RoomView;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Members use-cases (INTENT.md M02): list with filters. The query and response
 * mapping are a faithful port of {@code src/app/api/members/route.ts} GET.
 *
 * <p>Tenant scoping goes through {@link Party} (same as the Next
 * {@code party.tenantId = user.tenantId}). Pagination uses
 * {@link PageRequest#of(int, int)} for a clean 300-row cap.
 */
@Service
public class MemberQueryService {

  private static final int MAX_ROWS = 300;

  private final MemberProfileRepository members;
  private final LeaseRepository leases;

  public MemberQueryService(MemberProfileRepository members, LeaseRepository leases) {
    this.members = members;
    this.leases = leases;
  }

  @Transactional(readOnly = true)
  public List<MemberRow> list(String tenantId, String status, String propertyId, String q) {
    List<MemberProfile> rows = members.search(tenantId, status, propertyId, q, PageRequest.of(0, MAX_ROWS));
    Map<String, Lease> firstByMember = firstActiveOrDraftByMember(rows);
    return rows.stream()
        .map(m -> toRow(m, firstByMember.get(m.getId())))
        .toList();
  }

  /** One query for the active/draft leases of all members, then pick the first per member. */
  private Map<String, Lease> firstActiveOrDraftByMember(List<MemberProfile> rows) {
    if (rows.isEmpty()) return Map.of();
    List<String> ids = rows.stream().map(MemberProfile::getId).toList();
    // Query ordered by createdAt ASC; putIfAbsent keeps the earliest.
    List<Lease> found = leases.findActiveOrDraftByMemberProfileIds(ids);
    Map<String, Lease> map = new LinkedHashMap<>();
    for (Lease l : found) {
      map.putIfAbsent(l.getMemberProfileId(), l);
    }
    return map;
  }

  private static MemberRow toRow(MemberProfile m, Lease lease) {
    Party p = m.getParty();
    PartyView party = new PartyView(p.getId(), p.getName(), p.getEmail(), p.getPhone());

    String propertyCode = m.getHomeProperty() != null
        ? m.getHomeProperty().getCode() : null;

    List<LeaseRow> leaseRows = lease == null
        ? List.of()
        : List.of(new LeaseRow(
            lease.getId(),
            lease.getCode(),
            lease.getStatus(),
            new RoomView(lease.getRoom() != null ? lease.getRoom().getNumber() : null)));

    return new MemberRow(
        m.getId(),
        m.getPartyId(),
        m.getStatus(),
        m.getHomePropertyId(),
        propertyCode,
        party,
        leaseRows);
  }
}