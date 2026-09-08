package com.rentmanager.kernel.party;

import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

public interface PartyRepository extends JpaRepository<Party, String> {
  Optional<Party> findByEmailIgnoreCaseAndTenantId(String email, String tenantId);
}
