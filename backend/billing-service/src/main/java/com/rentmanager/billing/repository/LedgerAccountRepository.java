package com.rentmanager.billing.repository;

import com.rentmanager.billing.domain.LedgerAccount;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface LedgerAccountRepository extends JpaRepository<LedgerAccount, String> {
    Optional<LedgerAccount> findByCode(String code);
}
