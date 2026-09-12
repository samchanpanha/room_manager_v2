package com.rentmanager.kernel.domain;

import java.util.List;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

/**
 * Read access to {@link MemberProfile}. The list query is a faithful port of
 * the Next {@code prisma.memberProfile.findMany} in
 * {@code src/app/api/members/route.ts} GET: tenant via {@code party.tenantId},
 * optional status / homePropertyId / free-text filters, ordered by party name,
 * bounded by a pageable (take 300). Party and home property are join-fetched.
 */
public interface MemberProfileRepository extends JpaRepository<MemberProfile, String> {

  @Query("""
      select m from MemberProfile m
      join fetch m.party p
      left join fetch m.homeProperty hp
      where p.tenantId = :tenantId
        and (cast(:status as string) is null or m.status = cast(:status as string))
        and (cast(:propertyId as string) is null or m.homePropertyId = cast(:propertyId as string))
        and (cast(:q as string) is null
             or lower(p.name) like lower(concat('%', cast(:q as string), '%'))
             or lower(coalesce(cast(p.email as string), '')) like lower(concat('%', cast(:q as string), '%'))
             or lower(coalesce(cast(p.phone as string), '')) like lower(concat('%', cast(:q as string), '%'))
             or lower(coalesce(cast(m.idNumber as string), '')) like lower(concat('%', cast(:q as string), '%')))
      order by p.name asc
      """)
  List<MemberProfile> search(
      @Param("tenantId") String tenantId,
      @Param("status") String status,
      @Param("propertyId") String propertyId,
      @Param("q") String q,
      Pageable pageable);
}