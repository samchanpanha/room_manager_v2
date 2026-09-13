package com.rentmanager.billing.repository;

import com.rentmanager.billing.domain.PaymentAllocation;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface PaymentAllocationRepository extends JpaRepository<PaymentAllocation, String> {
    List<PaymentAllocation> findByPaymentId(String paymentId);
    List<PaymentAllocation> findByInvoiceId(String invoiceId);
}
