package com.rentmanager.billing.service;

import com.rentmanager.billing.domain.Invoice;
import com.rentmanager.billing.domain.InvoiceItem;
import com.rentmanager.billing.dto.CreateInvoiceRequest;
import com.rentmanager.billing.dto.InvoiceDto;
import com.rentmanager.billing.dto.InvoiceItemDto;
import com.rentmanager.billing.dto.LedgerPostingRequest;
import com.rentmanager.billing.kafka.BillingOutboxService;
import com.rentmanager.billing.repository.InvoiceItemRepository;
import com.rentmanager.billing.repository.InvoiceRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@Service
public class InvoiceService {

    private final InvoiceRepository invoiceRepository;
    private final InvoiceItemRepository itemRepository;
    private final LedgerService ledgerService;
    private final BillingOutboxService outboxService;

    public InvoiceService(InvoiceRepository invoiceRepository,
                          InvoiceItemRepository itemRepository,
                          LedgerService ledgerService,
                          BillingOutboxService outboxService) {
        this.invoiceRepository = invoiceRepository;
        this.itemRepository = itemRepository;
        this.ledgerService = ledgerService;
        this.outboxService = outboxService;
    }

    @Transactional(readOnly = true)
    public List<InvoiceDto> getInvoicesByProperty(String propertyId) {
        return invoiceRepository.findByPropertyId(propertyId).stream()
            .map(this::toDto)
            .toList();
    }

    @Transactional(readOnly = true)
    public InvoiceDto getInvoiceById(String id) {
        Invoice invoice = invoiceRepository.findById(id)
            .orElseThrow(() -> new IllegalArgumentException("Invoice not found with id: " + id));
        return toDto(invoice);
    }

    @Transactional
    public InvoiceDto createInvoice(CreateInvoiceRequest request, String createdById) {
        String invoiceId = "inv_" + UUID.randomUUID().toString().replace("-", "").substring(0, 16);
        String code = "INV-" + UUID.randomUUID().toString().substring(0, 8).toUpperCase();

        int totalMinor = 0;
        int rentRevenueMinor = 0;
        int serviceIncomeMinor = 0;

        List<InvoiceItem> itemsToSave = new ArrayList<>();

        if (request.items() != null) {
            for (var itemReq : request.items()) {
                int itemAmount = itemReq.qty() * itemReq.unitMinor();
                totalMinor += itemAmount;

                if ("rent".equalsIgnoreCase(itemReq.kind())) {
                    rentRevenueMinor += itemAmount;
                } else {
                    serviceIncomeMinor += itemAmount;
                }

                String itemId = "item_" + UUID.randomUUID().toString().replace("-", "").substring(0, 16);
                itemsToSave.add(new InvoiceItem(
                    itemId, invoiceId, itemReq.kind(), itemReq.name(), itemReq.qty(), itemReq.unitMinor(), itemAmount
                ));
            }
        }

        Invoice invoice = new Invoice(
            invoiceId, code, request.propertyId(), request.leaseId(), request.memberProfileId(),
            request.periodStart(), request.periodEnd(), totalMinor
        );
        invoice.setDueDate(request.dueDate() != null ? request.dueDate() : Instant.now().plusSeconds(86400 * 7));
        invoice.setDeposit(request.isDeposit());
        invoice.setStatus("issued");
        invoice.setIssuedAt(Instant.now());

        Invoice savedInvoice = invoiceRepository.save(invoice);
        itemRepository.saveAll(itemsToSave);

        // POST TO LEDGER: Debit 1200 (Accounts Receivable) vs Credit 4000 (Rental Revenue) & 4100 (Service Income)
        if (totalMinor > 0) {
            List<LedgerPostingRequest.EntryRequest> ledgerEntries = new ArrayList<>();
            // Debit Accounts Receivable
            ledgerEntries.add(new LedgerPostingRequest.EntryRequest("1200", totalMinor, 0, "Invoice AR: " + code));

            if (rentRevenueMinor > 0) {
                ledgerEntries.add(new LedgerPostingRequest.EntryRequest("4000", 0, rentRevenueMinor, "Rental Revenue: " + code));
            }
            if (serviceIncomeMinor > 0) {
                ledgerEntries.add(new LedgerPostingRequest.EntryRequest("4100", 0, serviceIncomeMinor, "Service Income: " + code));
            }

            ledgerService.postTransaction(
                new LedgerPostingRequest(
                    "Invoice issued: " + code, "invoice", savedInvoice.getId(),
                    savedInvoice.getPropertyId(), savedInvoice.getMemberProfileId(), ledgerEntries
                ),
                createdById
            );
        }

        outboxService.publishEvent(
            "invoice.generated",
            savedInvoice.getPropertyId(),
            Map.of(
                "invoiceId", savedInvoice.getId(),
                "code", savedInvoice.getCode(),
                "memberProfileId", savedInvoice.getMemberProfileId(),
                "totalMinor", savedInvoice.getTotalMinor()
            )
        );

        return toDto(savedInvoice);
    }

    private InvoiceDto toDto(Invoice inv) {
        List<InvoiceItemDto> items = itemRepository.findByInvoiceId(inv.getId()).stream()
            .map(it -> new InvoiceItemDto(it.getId(), it.getKind(), it.getName(), it.getQty(), it.getUnitMinor(), it.getAmountMinor()))
            .toList();

        return new InvoiceDto(
            inv.getId(),
            inv.getCode(),
            inv.getPropertyId(),
            inv.getLeaseId(),
            inv.getMemberProfileId(),
            inv.getStatus(),
            inv.getPeriodStart(),
            inv.getPeriodEnd(),
            inv.getIssuedAt(),
            inv.getDueDate(),
            inv.getSubtotalMinor(),
            inv.getDiscountMinor(),
            inv.getTaxMinor(),
            inv.getTotalMinor(),
            inv.getAmountPaidMinor(),
            inv.getAmountDueMinor(),
            inv.isDeposit(),
            items,
            inv.getCreatedAt()
        );
    }
}
