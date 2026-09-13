package com.rentmanager.billing.repository;

import com.rentmanager.billing.domain.Invoice;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface InvoiceRepository extends JpaRepository<Invoice, String> {
    List<Invoice> findByPropertyId(String propertyId);
    List<Invoice> findByLeaseId(String leaseId);
    List<Invoice> findByMemberProfileId(String memberProfileId);
    Optional<Invoice> findByCode(String code);
}
