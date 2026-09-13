package com.rentmanager.billing.service;

import com.rentmanager.billing.domain.Invoice;
import com.rentmanager.billing.domain.Payment;
import com.rentmanager.billing.domain.PaymentAllocation;
import com.rentmanager.billing.dto.LedgerPostingRequest;
import com.rentmanager.billing.dto.PaymentDto;
import com.rentmanager.billing.dto.RecordPaymentRequest;
import com.rentmanager.billing.kafka.BillingOutboxService;
import com.rentmanager.billing.repository.InvoiceRepository;
import com.rentmanager.billing.repository.PaymentAllocationRepository;
import com.rentmanager.billing.repository.PaymentRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@Service
public class PaymentService {

    private final PaymentRepository paymentRepository;
    private final PaymentAllocationRepository allocationRepository;
    private final InvoiceRepository invoiceRepository;
    private final LedgerService ledgerService;
    private final BillingOutboxService outboxService;

    public PaymentService(PaymentRepository paymentRepository,
                          PaymentAllocationRepository allocationRepository,
                          InvoiceRepository invoiceRepository,
                          LedgerService ledgerService,
                          BillingOutboxService outboxService) {
        this.paymentRepository = paymentRepository;
        this.allocationRepository = allocationRepository;
        this.invoiceRepository = invoiceRepository;
        this.ledgerService = ledgerService;
        this.outboxService = outboxService;
    }

    @Transactional(readOnly = true)
    public List<PaymentDto> getPaymentsByMember(String memberProfileId) {
        return paymentRepository.findByMemberProfileId(memberProfileId).stream()
            .map(this::toDto)
            .toList();
    }

    @Transactional
    public PaymentDto recordPayment(RecordPaymentRequest request, String createdById) {
        String paymentId = "pmt_" + UUID.randomUUID().toString().replace("-", "").substring(0, 16);
        String code = "PMT-" + UUID.randomUUID().toString().substring(0, 8).toUpperCase();
        String receiptCode = "RCP-" + UUID.randomUUID().toString().substring(0, 8).toUpperCase();

        Payment payment = new Payment(
            paymentId, code, request.memberProfileId(), request.propertyId(), request.method(), request.amountMinor()
        );
        payment.setStatus("confirmed");
        payment.setConfirmedAt(Instant.now());
        payment.setReceiptCode(receiptCode);

        int totalAllocated = 0;
        List<PaymentAllocation> allocationsToSave = new ArrayList<>();

        if (request.allocations() != null) {
            for (var allocReq : request.allocations()) {
                Invoice invoice = invoiceRepository.findById(allocReq.invoiceId())
                    .orElseThrow(() -> new IllegalArgumentException("Invoice not found: " + allocReq.invoiceId()));

                int allocAmount = allocReq.amountMinor();
                totalAllocated += allocAmount;

                // Update Invoice
                int newPaid = invoice.getAmountPaidMinor() + allocAmount;
                int newDue = Math.max(0, invoice.getTotalMinor() - newPaid - invoice.getAmountCreditedMinor());
                invoice.setAmountPaidMinor(newPaid);
                invoice.setAmountDueMinor(newDue);
                invoice.setStatus(newDue == 0 ? "paid" : "partial_paid");
                invoice.setUpdatedAt(Instant.now());
                invoiceRepository.save(invoice);

                String allocId = "alloc_" + UUID.randomUUID().toString().replace("-", "").substring(0, 16);
                allocationsToSave.add(new PaymentAllocation(allocId, paymentId, invoice.getId(), allocAmount));
            }
        }

        payment.setRemainingMinor(Math.max(0, request.amountMinor() - totalAllocated));
        Payment savedPayment = paymentRepository.save(payment);
        if (!allocationsToSave.isEmpty()) {
            allocationRepository.saveAll(allocationsToSave);
        }

        // POST TO LEDGER: Debit 1100 (Cash/Bank) vs Credit 1200 (Accounts Receivable)
        if (request.amountMinor() > 0) {
            List<LedgerPostingRequest.EntryRequest> entries = new ArrayList<>();
            // Debit Cash/Bank
            entries.add(new LedgerPostingRequest.EntryRequest("1100", request.amountMinor(), 0, "Payment cash/bank: " + code));
            // Credit Accounts Receivable for allocated amount
            if (totalAllocated > 0) {
                entries.add(new LedgerPostingRequest.EntryRequest("1200", 0, totalAllocated, "Payment AR clearing: " + code));
            }
            // Credit Member Unallocated Credit for any remaining amount
            int unallocated = request.amountMinor() - totalAllocated;
            if (unallocated > 0) {
                entries.add(new LedgerPostingRequest.EntryRequest("2100", 0, unallocated, "Member unallocated deposit/credit: " + code));
            }

            ledgerService.postTransaction(
                new LedgerPostingRequest(
                    "Payment received: " + code, "payment", savedPayment.getId(),
                    savedPayment.getPropertyId(), savedPayment.getMemberProfileId(), entries
                ),
                createdById
            );
        }

        outboxService.publishEvent(
            "payment.received",
            savedPayment.getPropertyId(),
            Map.of(
                "paymentId", savedPayment.getId(),
                "code", savedPayment.getCode(),
                "memberProfileId", savedPayment.getMemberProfileId(),
                "amountMinor", savedPayment.getAmountMinor(),
                "receiptCode", savedPayment.getReceiptCode()
            )
        );

        return toDto(savedPayment);
    }

    private PaymentDto toDto(Payment p) {
        return new PaymentDto(
            p.getId(),
            p.getCode(),
            p.getMemberProfileId(),
            p.getPropertyId(),
            p.getMethod(),
            p.getStatus(),
            p.getAmountMinor(),
            p.getRemainingMinor(),
            p.getReceiptCode(),
            p.getReceivedAt(),
            p.getCreatedAt()
        );
    }
}
