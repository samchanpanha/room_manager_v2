package com.rentmanager.billing.repository;

import com.rentmanager.billing.domain.Lease;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface LeaseRepository extends JpaRepository<Lease, String> {
    List<Lease> findByPropertyId(String propertyId);
    List<Lease> findByMemberProfileId(String memberProfileId);
    List<Lease> findByStatus(String status);
    Optional<Lease> findByCode(String code);
}
