package com.rentmanager.members.domain;

import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface MemberRepository extends JpaRepository<MemberProfile, String> {

  Optional<MemberProfile> findByIdAndTenantId(String id, String tenantId);

  @Query("""
      select m from MemberProfile m
      where m.tenantId = :tenantId
        and (:status is null or m.status = :status)
        and (:propertyId is null or m.homePropertyId = :propertyId)
      order by m.createdAt desc
      """)
  List<MemberProfile> search(
      @Param("tenantId") String tenantId,
      @Param("status") String status,
      @Param("propertyId") String propertyId);
}
