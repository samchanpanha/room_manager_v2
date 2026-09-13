package com.rentmanager.kernel.domain;

import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

/**
 * Read/write access to {@link AuditLog}. The "last row" lookup matches
 * {@code prisma.auditLog.findFirst({ orderBy: [{ createdAt: "desc" }, { id: "desc" }] })}.
 */
public interface AuditLogRepository extends JpaRepository<AuditLog, String> {

  Optional<AuditLog> findFirstByOrderByCreatedAtDescIdDesc();
}