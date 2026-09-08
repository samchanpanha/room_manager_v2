package com.rentmanager.owners.domain;

import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

public interface OwnerRepository extends JpaRepository<OwnerProfile, String> {
  List<OwnerProfile> findByTenantIdOrderByCreatedAt(String tenantId);
  List<OwnerProfile> findByTenantIdAndIdInOrderByCreatedAt(String tenantId, List<String> ids);
  Optional<OwnerProfile> findByIdAndTenantId(String id, String tenantId);
}
