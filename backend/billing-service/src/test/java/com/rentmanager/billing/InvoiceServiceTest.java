package com.rentmanager.billing;

import com.rentmanager.billing.domain.Invoice;
import com.rentmanager.billing.dto.CreateInvoiceRequest;
import com.rentmanager.billing.dto.InvoiceDto;
import com.rentmanager.billing.kafka.BillingOutboxService;
import com.rentmanager.billing.repository.InvoiceItemRepository;
import com.rentmanager.billing.repository.InvoiceRepository;
import com.rentmanager.billing.service.InvoiceService;
import com.rentmanager.billing.service.LedgerService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.time.Instant;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

class InvoiceServiceTest {

    private InvoiceRepository invoiceRepository;
    private InvoiceItemRepository itemRepository;
    private LedgerService ledgerService;
    private BillingOutboxService outboxService;
    private InvoiceService invoiceService;

    @BeforeEach
    void setUp() {
        invoiceRepository = mock(InvoiceRepository.class);
        itemRepository = mock(InvoiceItemRepository.class);
        ledgerService = mock(LedgerService.class);
        outboxService = mock(BillingOutboxService.class);
        invoiceService = new InvoiceService(invoiceRepository, itemRepository, ledgerService, outboxService);
    }

    @Test
    void createInvoice_PostsToLedgerAndQueuesOutbox() {
        CreateInvoiceRequest request = new CreateInvoiceRequest(
            "prop_01", "lse_01", "mem_01",
            Instant.now(), Instant.now().plusSeconds(86400 * 30), Instant.now().plusSeconds(86400 * 7),
            false,
            List.of(
                new CreateInvoiceRequest.ItemRequest("rent", "Monthly Rent", 1, 30000),
                new CreateInvoiceRequest.ItemRequest("service", "WiFi", 1, 2000)
            )
        );

        when(invoiceRepository.save(any(Invoice.class))).thenAnswer(inv -> inv.getArgument(0));

        InvoiceDto dto = invoiceService.createInvoice(request, "user_01");

        assertNotNull(dto);
        assertEquals(32000, dto.totalMinor());
        assertEquals("issued", dto.status());

        verify(ledgerService, times(1)).postTransaction(any(), eq("user_01"));
        verify(outboxService, times(1)).publishEvent(eq("invoice.generated"), eq("prop_01"), anyMap());
    }
}
