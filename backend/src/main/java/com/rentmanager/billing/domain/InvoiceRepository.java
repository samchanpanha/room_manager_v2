package com.rentmanager.billing.domain;

import java.time.Instant;
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

  /**
   * A member's open invoices (positive due) ordered oldest-first — the FIFO
   * ordering the M09 allocation engine consumes (due date, then period start).
   */
  @Query("""
      select i from Invoice i
      where i.tenantId = :tenantId and i.memberProfileId = :memberId
        and i.status in ('issued','partial_paid','overdue')
        and i.amountDueMinor > 0
      order by coalesce(i.dueDate, i.periodStart) asc, i.periodStart asc
      """)
  List<Invoice> findOpenForMember(@Param("tenantId") String tenantId, @Param("memberId") String memberId);

  // ---- M06 rent-engine job support ---------------------------------------

  /** The latest non-void, non-deposit invoice for a lease — the period chain head. */
  Optional<Invoice> findFirstByLeaseIdAndTenantIdAndDepositFalseAndStatusNotOrderByPeriodEndDesc(
      String leaseId, String tenantId, String status);

  /** Whether a live (non-void) invoice already covers a lease period (idempotency). */
  boolean existsByLeaseIdAndPeriodStartAndTenantIdAndDepositFalseAndStatusNot(
      String leaseId, Instant periodStart, String tenantId, String status);

  /** Late-fee candidates: live invoices with a positive balance past the grace cutoff. */
  @Query("""
      select i from Invoice i
      where i.tenantId = :tenantId
        and i.status in ('issued','partial_paid','overdue')
        and i.amountDueMinor > 0
        and i.dueDate is not null and i.dueDate < :graceCutoff
      """)
  List<Invoice> findLateFeeCandidates(@Param("tenantId") String tenantId,
      @Param("graceCutoff") Instant graceCutoff);

  /** Dunning candidates: live invoices already past their due date. */
  @Query("""
      select i from Invoice i
      where i.tenantId = :tenantId
        and i.status in ('issued','partial_paid','overdue')
        and i.dueDate is not null and i.dueDate < :today
      """)
  List<Invoice> findDunningCandidates(@Param("tenantId") String tenantId,
      @Param("today") Instant today);
}
