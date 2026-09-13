package com.rentmanager.billing.repository;

import com.rentmanager.billing.domain.Deposit;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface DepositRepository extends JpaRepository<Deposit, String> {
    Optional<Deposit> findByLeaseId(String leaseId);
    List<Deposit> findByPropertyId(String propertyId);
}
