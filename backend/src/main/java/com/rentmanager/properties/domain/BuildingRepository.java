package com.rentmanager.properties.domain;

import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

/** Standalone building repo (mutations for ownership assignment, M03). */
public interface BuildingRepository extends JpaRepository<Building, String> {
  Optional<Building> findByIdAndTenantId(String id, String tenantId);
}
