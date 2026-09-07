package com.rentmanager.billing.domain;

import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface InvoiceRepository extends JpaRepository<Invoice, String> {
  Optional<Invoice> findByIdAndTenantId(String id, String tenantId);
  List<Invoice> findByTenantIdOrderByPeriodStartDescCodeDesc(String tenantId);

  @Query("""
      select i from Invoice i
      where i.tenantId = :tenantId
        and (:status is null or i.status = :status)
        and (:propertyId is null or i.propertyId = :propertyId)
      order by i.periodStart desc, i.code desc
      """)
  List<Invoice> search(@Param("tenantId") String tenantId,
      @Param("status") String status, @Param("propertyId") String propertyId);

  /** Outstanding dues for a member across live invoices — powers the M05 gate. */
  @Query("""
      select coalesce(sum(i.amountDueMinor), 0) from Invoice i
      where i.tenantId = :tenantId and i.memberProfileId = :memberId
        and i.status in ('issued','partial_paid','overdue')
      """)
  long sumOpenDuesForMember(@Param("tenantId") String tenantId, @Param("memberId") String memberId);
}
