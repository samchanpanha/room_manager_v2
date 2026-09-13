package com.rentmanager.ops.repository;

import com.rentmanager.ops.domain.Inspection;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface InspectionRepository extends JpaRepository<Inspection, String> {
    List<Inspection> findByPropertyId(String propertyId);
    List<Inspection> findByLeaseId(String leaseId);
    Optional<Inspection> findByCode(String code);
}
