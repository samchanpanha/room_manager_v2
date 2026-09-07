package com.rentmanager.billing.domain;

import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface PaymentRepository extends JpaRepository<Payment, String> {
  Optional<Payment> findByIdAndTenantId(String id, String tenantId);
  Optional<Payment> findByIdempotencyKeyAndTenantId(String idempotencyKey, String tenantId);
  Optional<Payment> findByGatewayRefAndTenantId(String gatewayRef, String tenantId);

  @Query("""
      select p from Payment p
      where p.tenantId = :tenantId
        and (:status is null or p.status = :status)
        and (:method is null or p.method = :method)
      order by p.receivedAt desc
      """)
  List<Payment> search(@Param("tenantId") String tenantId,
      @Param("status") String status, @Param("method") String method);
}
