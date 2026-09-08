package com.rentmanager.leasing.domain;

import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

public interface LeaseRepository extends JpaRepository<Lease, String> {
  Optional<Lease> findByIdAndTenantId(String id, String tenantId);
  List<Lease> findByTenantIdOrderByCreatedAtDesc(String tenantId);
  List<Lease> findByTenantIdAndStatusOrderByCreatedAtDesc(String tenantId, String status);
  List<Lease> findByTenantIdAndPropertyIdInOrderByCreatedAtDesc(String tenantId, List<String> propertyIds);

  // Placement facts.
  List<Lease> findByRoomIdAndStatusAndTenantId(String roomId, String status, String tenantId);
  long countByRoomIdAndStatusAndTenantIdAndIdNot(String roomId, String status, String tenantId, String id);
  long countByMemberProfileIdAndStatusAndTenantIdAndIdNot(String memberProfileId, String status, String tenantId, String id);
}
