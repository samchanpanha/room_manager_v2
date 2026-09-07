package com.rentmanager.billing.domain;

import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

public interface LateFeeRuleRepository extends JpaRepository<LateFeeRule, String> {
  Optional<LateFeeRule> findFirstByTenantIdAndIsActiveTrue(String tenantId);
}
