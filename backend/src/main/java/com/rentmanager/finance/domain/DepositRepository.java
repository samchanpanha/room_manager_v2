package com.rentmanager.finance.domain;

import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

public interface DepositRepository extends JpaRepository<Deposit, String> {
  Optional<Deposit> findByIdAndTenantId(String id, String tenantId);
  Optional<Deposit> findByLeaseIdAndTenantId(String leaseId, String tenantId);
  Optional<Deposit> findByInvoiceIdAndTenantId(String invoiceId, String tenantId);
  List<Deposit> findByTenantIdOrderByCreatedAtDesc(String tenantId);
  List<Deposit> findByTenantIdAndStatusOrderByCreatedAtDesc(String tenantId, String status);
}
