package com.rentmanager.staff.repository;

import com.rentmanager.staff.domain.OwnerStatement;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface OwnerStatementRepository extends JpaRepository<OwnerStatement, String> {
    List<OwnerStatement> findByOwnerProfileId(String ownerProfileId);
    List<OwnerStatement> findByPropertyId(String propertyId);
    Optional<OwnerStatement> findByContractIdAndMonth(String contractId, String month);
}
