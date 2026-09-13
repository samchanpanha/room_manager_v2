package com.rentmanager.billing.repository;

import com.rentmanager.billing.domain.LedgerTransaction;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface LedgerTransactionRepository extends JpaRepository<LedgerTransaction, String> {
    List<LedgerTransaction> findByRefTypeAndRefId(String refType, String refId);
    List<LedgerTransaction> findByPropertyId(String propertyId);
    List<LedgerTransaction> findByMemberId(String memberId);
}
