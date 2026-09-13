package com.rentmanager.billing.repository;

import com.rentmanager.billing.domain.Payment;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface PaymentRepository extends JpaRepository<Payment, String> {
    List<Payment> findByMemberProfileId(String memberProfileId);
    List<Payment> findByPropertyId(String propertyId);
    Optional<Payment> findByCode(String code);
}
