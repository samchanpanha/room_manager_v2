package com.rentmanager.kernel.domain;

import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

/**
 * Read access to the {@link Lease} rows shown on the members list: the active
 * or draft lease per member (the Next query selects them with
 * {@code where status in [active,draft], take 1}), joined to its room. Earliest
 * first for a deterministic pick.
 */
public interface LeaseRepository extends JpaRepository<Lease, String> {

  @Query("""
      select l from Lease l
      join fetch l.room
      where l.memberProfileId in :memberIds
        and l.status in ('active', 'draft')
      order by l.createdAt asc
      """)
  List<Lease> findActiveOrDraftByMemberProfileIds(@Param("memberIds") List<String> memberIds);
}