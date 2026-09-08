package com.rentmanager.iam.domain;

import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

public interface UserRepository extends JpaRepository<User, String> {
  Optional<User> findByEmailIgnoreCaseAndTenantId(String email, String tenantId);
  Optional<User> findByIdAndTenantId(String id, String tenantId);
  List<User> findByTenantIdOrderByCreatedAtDesc(String tenantId);
}
