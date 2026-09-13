package com.rentmanager.commerce.service;

import com.rentmanager.commerce.domain.PosSale;
import com.rentmanager.commerce.domain.PosSession;
import com.rentmanager.commerce.dto.*;
import com.rentmanager.commerce.repository.PosSaleItemRepository;
import com.rentmanager.commerce.repository.PosSaleRepository;
import com.rentmanager.commerce.repository.PosSessionRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class PosServiceTest {

    @Mock
    private PosSessionRepository sessionRepository;

    @Mock
    private PosSaleRepository saleRepository;

    @Mock
    private PosSaleItemRepository saleItemRepository;

    @Mock
    private StockService stockService;

    @Mock
    private CommerceOutboxService outboxService;

    @InjectMocks
    private PosService posService;

    private String propertyId = "prop_123";
    private String userId = "user_456";

    @BeforeEach
    void setUp() {}

    @Test
    @DisplayName("openSession creates a new open POS session")
    void openSession_success() {
        when(sessionRepository.findByPropertyIdAndStatus(propertyId, "open")).thenReturn(Optional.empty());
        when(sessionRepository.save(any(PosSession.class))).thenAnswer(i -> i.getArgument(0));

        OpenSessionRequest req = new OpenSessionRequest();
        req.setPropertyId(propertyId);
        req.setOpeningCashMinor(5000); // $50.00 opening cash
        req.setNotes("Morning Shift");

        PosSessionDto session = posService.openSession(req, userId);

        assertThat(session).isNotNull();
        assertThat(session.getPropertyId()).isEqualTo(propertyId);
        assertThat(session.getOpeningCashMinor()).isEqualTo(5000);
        assertThat(session.getStatus()).isEqualTo("open");

        verify(outboxService).publishEvent(eq("pos.session_opened"), eq(propertyId), any());
    }

    @Test
    @DisplayName("openSession throws exception if session already open")
    void openSession_alreadyOpen() {
        PosSession existing = new PosSession("poss_1", "POS-001", propertyId, userId, 5000);
        when(sessionRepository.findByPropertyIdAndStatus(propertyId, "open")).thenReturn(Optional.of(existing));

        OpenSessionRequest req = new OpenSessionRequest();
        req.setPropertyId(propertyId);

        assertThatThrownBy(() -> posService.openSession(req, userId))
            .isInstanceOf(IllegalStateException.class)
            .hasMessageContaining("already open");
    }

    @Test
    @DisplayName("createSale creates sale, updates session cash, and decrements stock")
    void createSale_success() {
        PosSession session = new PosSession("poss_1", "POS-001", propertyId, userId, 5000);
        when(sessionRepository.findById("poss_1")).thenReturn(Optional.of(session));
        when(saleRepository.save(any(PosSale.class))).thenAnswer(i -> i.getArgument(0));
        when(saleItemRepository.saveAll(anyList())).thenAnswer(i -> i.getArgument(0));

        CreateSaleRequest req = new CreateSaleRequest();
        req.setSessionId("poss_1");
        req.setPropertyId(propertyId);
        req.setMethod("cash");
        req.setDiscountMinor(200);

        SaleItemRequest item1 = new SaleItemRequest();
        item1.setProductId("prod_water");
        item1.setName("Mineral Water");
        item1.setQtyMilli(2000); // 2 units
        item1.setUnitPriceMinor(150); // $1.50 per unit -> $3.00 (300 minor)
        item1.setStockItemId("stk_water");

        req.setItems(List.of(item1));

        PosSaleDto sale = posService.createSale(req, userId);

        assertThat(sale).isNotNull();
        assertThat(sale.getMethod()).isEqualTo("cash");
        // 300 gross - 200 discount = 100 minor net total
        assertThat(sale.getTotalMinor()).isEqualTo(100);

        // Verify stock adjustment was called
        verify(stockService).adjustStock(eq("stk_water"), any(AdjustStockRequest.class));

        // Verify outbox event
        verify(outboxService).publishEvent(eq("pos.sale_completed"), eq(propertyId), any());
    }

    @Test
    @DisplayName("closeSession calculates expected cash and cash diff correctly")
    void closeSession_success() {
        PosSession session = new PosSession("poss_1", "POS-001", propertyId, userId, 5000);
        when(sessionRepository.findById("poss_1")).thenReturn(Optional.of(session));
        when(sessionRepository.save(any(PosSession.class))).thenAnswer(i -> i.getArgument(0));

        PosSale cashSale = new PosSale("sale_1", "SALE-1", "poss_1", propertyId, "cash", 1500, userId);
        PosSale qrSale = new PosSale("sale_2", "SALE-2", "poss_1", propertyId, "qr", 2000, userId);
        when(saleRepository.findBySessionId("poss_1")).thenReturn(List.of(cashSale, qrSale));

        CloseSessionRequest req = new CloseSessionRequest();
        req.setActualCashMinor(6500); // Expected: 5000 opening + 1500 cash sale = 6500. Diff = 0.

        PosSessionDto closed = posService.closeSession("poss_1", req, userId);

        assertThat(closed.getStatus()).isEqualTo("closed");
        assertThat(closed.getExpectedCashMinor()).isEqualTo(6500);
        assertThat(closed.getActualCashMinor()).isEqualTo(6500);
        assertThat(closed.getCashDiffMinor()).isEqualTo(0);

        verify(outboxService).publishEvent(eq("pos.session_closed"), eq(propertyId), any());
    }
}
