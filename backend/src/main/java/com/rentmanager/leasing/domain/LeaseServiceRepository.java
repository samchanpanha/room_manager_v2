package com.rentmanager.leasing.domain;

import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

/** Repository for standalone {@link LeaseService} snapshot rows (M12). */
public interface LeaseServiceRepository extends JpaRepository<LeaseService, String> {
  Optional<LeaseService> findByIdAndTenantId(String id, String tenantId);
}
