package com.rentmanager.iam.domain;

import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

public interface RoleRepository extends JpaRepository<Role, String> {
  List<Role> findByTenantIdOrderByName(String tenantId);
  Optional<Role> findByKeyAndTenantId(String key, String tenantId);
}
