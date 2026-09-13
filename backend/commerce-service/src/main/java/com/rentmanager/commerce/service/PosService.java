package com.rentmanager.commerce.service;

import com.rentmanager.commerce.domain.PosSale;
import com.rentmanager.commerce.domain.PosSaleItem;
import com.rentmanager.commerce.domain.PosSession;
import com.rentmanager.commerce.dto.*;
import com.rentmanager.commerce.repository.PosSaleItemRepository;
import com.rentmanager.commerce.repository.PosSaleRepository;
import com.rentmanager.commerce.repository.PosSessionRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@Service
public class PosService {

    private final PosSessionRepository sessionRepository;
    private final PosSaleRepository saleRepository;
    private final PosSaleItemRepository saleItemRepository;
    private final StockService stockService;
    private final CommerceOutboxService outboxService;

    public PosService(PosSessionRepository sessionRepository,
                      PosSaleRepository saleRepository,
                      PosSaleItemRepository saleItemRepository,
                      StockService stockService,
                      CommerceOutboxService outboxService) {
        this.sessionRepository = sessionRepository;
        this.saleRepository = saleRepository;
        this.saleItemRepository = saleItemRepository;
        this.stockService = stockService;
        this.outboxService = outboxService;
    }

    @Transactional
    public PosSessionDto openSession(OpenSessionRequest request, String openedById) {
        // Check if session is already open
        sessionRepository.findByPropertyIdAndStatus(request.getPropertyId(), "open")
            .ifPresent(s -> {
                throw new IllegalStateException("An active POS session is already open for property: " + request.getPropertyId());
            });

        String sessionId = "poss_" + UUID.randomUUID().toString().replace("-", "").substring(0, 16);
        String code = "POS-" + UUID.randomUUID().toString().substring(0, 8).toUpperCase();

        PosSession session = new PosSession(sessionId, code, request.getPropertyId(), openedById, request.getOpeningCashMinor());
        session.setNotes(request.getNotes());

        PosSession saved = sessionRepository.save(session);

        outboxService.publishEvent(
            "pos.session_opened",
            saved.getPropertyId(),
            Map.of("sessionId", saved.getId(), "code", saved.getCode(), "openedById", openedById)
        );

        return new PosSessionDto(saved);
    }

    @Transactional
    public PosSessionDto closeSession(String sessionId, CloseSessionRequest request, String closedById) {
        PosSession session = sessionRepository.findById(sessionId)
            .orElseThrow(() -> new IllegalArgumentException("Session not found: " + sessionId));

        if (!"open".equals(session.getStatus())) {
            throw new IllegalStateException("Session is not open: " + sessionId);
        }

        // Calculate expected cash from cash sales in this session
        List<PosSale> sales = saleRepository.findBySessionId(sessionId);
        int cashSalesTotal = sales.stream()
            .filter(s -> "cash".equalsIgnoreCase(s.getMethod()))
            .mapToInt(PosSale::getTotalMinor)
            .sum();

        int expectedCash = session.getOpeningCashMinor() + cashSalesTotal;
        int diff = request.getActualCashMinor() - expectedCash;

        session.setExpectedCashMinor(expectedCash);
        session.setActualCashMinor(request.getActualCashMinor());
        session.setCashDiffMinor(diff);
        session.setStatus("closed");
        session.setClosedById(closedById);
        session.setClosedAt(Instant.now());
        if (request.getNotes() != null) {
            session.setNotes(request.getNotes());
        }

        PosSession saved = sessionRepository.save(session);

        outboxService.publishEvent(
            "pos.session_closed",
            saved.getPropertyId(),
            Map.of(
                "sessionId", saved.getId(),
                "expectedCashMinor", expectedCash,
                "actualCashMinor", request.getActualCashMinor(),
                "cashDiffMinor", diff
            )
        );

        return new PosSessionDto(saved);
    }

    @Transactional(readOnly = true)
    public List<PosSessionDto> getSessions(String propertyId) {
        return sessionRepository.findByPropertyId(propertyId).stream()
            .map(PosSessionDto::new)
            .toList();
    }

    @Transactional(readOnly = true)
    public PosSessionDto getActiveSession(String propertyId) {
        return sessionRepository.findByPropertyIdAndStatus(propertyId, "open")
            .map(PosSessionDto::new)
            .orElse(null);
    }

    @Transactional
    public PosSaleDto createSale(CreateSaleRequest request, String soldById) {
        PosSession session = sessionRepository.findById(request.getSessionId())
            .orElseThrow(() -> new IllegalArgumentException("Session not found: " + request.getSessionId()));

        if (!"open".equals(session.getStatus())) {
            throw new IllegalStateException("POS session is not open");
        }

        String saleId = "sale_" + UUID.randomUUID().toString().replace("-", "").substring(0, 16);
        String code = "SALE-" + UUID.randomUUID().toString().substring(0, 8).toUpperCase();

        int grossTotal = 0;
        List<PosSaleItem> itemsToSave = new ArrayList<>();

        for (SaleItemRequest itemReq : request.getItems()) {
            String itemId = "sli_" + UUID.randomUUID().toString().replace("-", "").substring(0, 16);
            int lineMinor = (int) (((long) itemReq.getQtyMilli() * itemReq.getUnitPriceMinor()) / 1000);
            grossTotal += lineMinor;

            PosSaleItem item = new PosSaleItem(
                itemId, saleId, itemReq.getProductId(), itemReq.getName(),
                itemReq.getQtyMilli(), itemReq.getUnitPriceMinor(), lineMinor
            );
            item.setStockItemId(itemReq.getStockItemId());
            itemsToSave.add(item);

            // Auto-decrement inventory if linked to a stock item
            if (itemReq.getStockItemId() != null && !itemReq.getStockItemId().isBlank()) {
                AdjustStockRequest adjReq = new AdjustStockRequest();
                adjReq.setType("sale");
                adjReq.setDeltaQtyMilli(-itemReq.getQtyMilli());
                adjReq.setSaleId(saleId);
                stockService.adjustStock(itemReq.getStockItemId(), adjReq);
            }
        }

        int netTotal = Math.max(0, grossTotal - request.getDiscountMinor());

        PosSale sale = new PosSale(
            saleId, code, session.getId(), request.getPropertyId(),
            request.getMethod(), netTotal, soldById
        );
        sale.setDiscountMinor(request.getDiscountMinor());
        sale.setMemberProfileId(request.getMemberProfileId());

        PosSale savedSale = saleRepository.save(sale);
        List<PosSaleItem> savedItems = saleItemRepository.saveAll(itemsToSave);

        // Update session expected cash if cash payment
        if ("cash".equalsIgnoreCase(request.getMethod())) {
            session.setExpectedCashMinor(session.getExpectedCashMinor() + netTotal);
            sessionRepository.save(session);
        }

        outboxService.publishEvent(
            "pos.sale_completed",
            savedSale.getPropertyId(),
            Map.of(
                "saleId", savedSale.getId(),
                "code", savedSale.getCode(),
                "sessionId", savedSale.getSessionId(),
                "totalMinor", savedSale.getTotalMinor(),
                "method", savedSale.getMethod()
            )
        );

        List<SaleItemDto> itemDtos = savedItems.stream().map(SaleItemDto::new).toList();
        return new PosSaleDto(savedSale, itemDtos);
    }

    @Transactional(readOnly = true)
    public PosSaleDto getSale(String saleId) {
        PosSale sale = saleRepository.findById(saleId)
            .orElseThrow(() -> new IllegalArgumentException("Sale not found: " + saleId));
        List<SaleItemDto> items = saleItemRepository.findBySaleId(saleId).stream()
            .map(SaleItemDto::new)
            .toList();
        return new PosSaleDto(sale, items);
    }

    @Transactional(readOnly = true)
    public List<PosSaleDto> getSalesBySession(String sessionId) {
        return saleRepository.findBySessionId(sessionId).stream()
            .map(sale -> {
                List<SaleItemDto> items = saleItemRepository.findBySaleId(sale.getId()).stream()
                    .map(SaleItemDto::new)
                    .toList();
                return new PosSaleDto(sale, items);
            })
            .toList();
    }
}
