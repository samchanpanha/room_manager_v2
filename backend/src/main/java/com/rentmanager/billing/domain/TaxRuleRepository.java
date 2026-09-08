package com.rentmanager.billing.domain;

import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

public interface TaxRuleRepository extends JpaRepository<TaxRule, String> {
  Optional<TaxRule> findFirstByTenantIdAndIsActiveTrueAndIsDefaultTrue(String tenantId);
}
