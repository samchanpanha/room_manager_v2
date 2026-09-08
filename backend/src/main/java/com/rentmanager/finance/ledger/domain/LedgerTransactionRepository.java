package com.rentmanager.finance.ledger.domain;

import java.time.Instant;
import java.util.List;
import java.util.Optional;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface LedgerTransactionRepository extends JpaRepository<LedgerTransaction, String> {

  Optional<LedgerTransaction> findFirstByReversalOfIdAndTenantId(String reversalOfId, String tenantId);

  @Query("""
      select t from LedgerTransaction t
      where t.tenantId = :tenantId and t.refType in :refTypes and t.refId = :refId
        and t.reversalOfId is null
      """)
  List<LedgerTransaction> findLive(@Param("tenantId") String tenantId,
      @Param("refTypes") List<String> refTypes, @Param("refId") String refId);

  List<LedgerTransaction> findByMemberIdAndTenantIdOrderByPostedAtAsc(String memberId, String tenantId);

  @Query("""
      select t from LedgerTransaction t
      where t.tenantId = :tenantId
        and (:refType is null or t.refType = :refType)
        and (:refId is null or t.refId = :refId)
        and (:propertyId is null or t.propertyId = :propertyId)
        and (:memberId is null or t.memberId = :memberId)
        and (:from is null or t.postedAt >= :from)
        and (:to is null or t.postedAt <= :to)
      order by t.postedAt desc
      """)
  List<LedgerTransaction> journal(@Param("tenantId") String tenantId,
      @Param("refType") String refType, @Param("refId") String refId,
      @Param("propertyId") String propertyId, @Param("memberId") String memberId,
      @Param("from") Instant from, @Param("to") Instant to, Pageable pageable);
}
