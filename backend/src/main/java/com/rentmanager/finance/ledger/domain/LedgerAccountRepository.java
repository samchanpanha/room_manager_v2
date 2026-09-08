package com.rentmanager.finance.ledger.domain;

import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

public interface LedgerAccountRepository extends JpaRepository<LedgerAccount, String> {
  Optional<LedgerAccount> findByCode(String code);
  List<LedgerAccount> findByCodeInAndActiveTrue(List<String> codes);
  List<LedgerAccount> findAllByOrderByCodeAsc();
}
