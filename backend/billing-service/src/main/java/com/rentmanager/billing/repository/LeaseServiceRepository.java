package com.rentmanager.billing.repository;

import com.rentmanager.billing.domain.LeaseService;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface LeaseServiceRepository extends JpaRepository<LeaseService, String> {
    List<LeaseService> findByLeaseId(String leaseId);
}
