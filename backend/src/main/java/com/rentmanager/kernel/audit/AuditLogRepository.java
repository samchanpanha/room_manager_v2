package com.rentmanager.kernel.audit;

import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

interface AuditLogRepository extends JpaRepository<AuditLog, String> {
  AuditLog findFirstByTenantIdOrderByCreatedAtDesc(String tenantId);
}
