package com.rentmanager.commerce.service;

import com.rentmanager.commerce.domain.StockItem;
import com.rentmanager.commerce.domain.StockMovement;
import com.rentmanager.commerce.dto.AdjustStockRequest;
import com.rentmanager.commerce.dto.CreateStockItemRequest;
import com.rentmanager.commerce.dto.StockItemDto;
import com.rentmanager.commerce.repository.StockItemRepository;
import com.rentmanager.commerce.repository.StockMovementRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@Service
public class StockService {

    private final StockItemRepository stockItemRepository;
    private final StockMovementRepository stockMovementRepository;
    private final CommerceOutboxService outboxService;

    public StockService(StockItemRepository stockItemRepository,
                        StockMovementRepository stockMovementRepository,
                        CommerceOutboxService outboxService) {
        this.stockItemRepository = stockItemRepository;
        this.stockMovementRepository = stockMovementRepository;
        this.outboxService = outboxService;
    }

    @Transactional(readOnly = true)
    public List<StockItemDto> getInventoryByProperty(String propertyId) {
        return stockItemRepository.findByPropertyId(propertyId).stream()
            .map(StockItemDto::new)
            .toList();
    }

    @Transactional(readOnly = true)
    public StockItemDto getStockItem(String id) {
        StockItem item = stockItemRepository.findById(id)
            .orElseThrow(() -> new IllegalArgumentException("Stock item not found: " + id));
        return new StockItemDto(item);
    }

    @Transactional
    public StockItemDto createStockItem(CreateStockItemRequest request) {
        String id = "stk_" + UUID.randomUUID().toString().replace("-", "").substring(0, 16);
        StockItem item = new StockItem(id, request.getName(), request.getCategory(), request.getUnit(), request.getPropertyId());
        item.setQtyMilli(request.getInitialQtyMilli());
        item.setAvgCostMilli(request.getAvgCostMilli());
        item.setMinQtyMilli(request.getMinQtyMilli());
        
        StockItem saved = stockItemRepository.save(item);

        if (request.getInitialQtyMilli() > 0) {
            String moveId = "stkmv_" + UUID.randomUUID().toString().replace("-", "").substring(0, 16);
            StockMovement movement = new StockMovement(moveId, saved.getId(), "adjustment", request.getInitialQtyMilli(), request.getInitialQtyMilli());
            movement.setAvgCostAfterMilli(request.getAvgCostMilli());
            stockMovementRepository.save(movement);
        }

        outboxService.publishEvent(
            "stock.created",
            saved.getPropertyId(),
            Map.of("stockItemId", saved.getId(), "name", saved.getName(), "qtyMilli", saved.getQtyMilli())
        );

        return new StockItemDto(saved);
    }

    @Transactional
    public StockItemDto adjustStock(String stockItemId, AdjustStockRequest request) {
        StockItem item = stockItemRepository.findById(stockItemId)
            .orElseThrow(() -> new IllegalArgumentException("Stock item not found: " + stockItemId));

        int oldQty = item.getQtyMilli();
        int delta = request.getDeltaQtyMilli();
        int newQty = Math.max(0, oldQty + delta);

        item.setQtyMilli(newQty);
        if (request.getUnitCostMilli() != null && request.getUnitCostMilli() > 0 && delta > 0) {
            // Update weighted average cost
            long oldTotalVal = (long) oldQty * item.getAvgCostMilli();
            long addedVal = (long) delta * request.getUnitCostMilli();
            int newAvgCost = newQty > 0 ? (int) ((oldTotalVal + addedVal) / newQty) : item.getAvgCostMilli();
            item.setAvgCostMilli(newAvgCost);
        }
        item.setUpdatedAt(Instant.now());

        StockItem saved = stockItemRepository.save(item);

        String moveId = "stkmv_" + UUID.randomUUID().toString().replace("-", "").substring(0, 16);
        StockMovement movement = new StockMovement(moveId, saved.getId(), request.getType(), delta, newQty);
        movement.setAvgCostAfterMilli(saved.getAvgCostMilli());
        movement.setSaleId(request.getSaleId());
        stockMovementRepository.save(movement);

        outboxService.publishEvent(
            "stock.updated",
            saved.getPropertyId(),
            Map.of(
                "stockItemId", saved.getId(),
                "type", request.getType(),
                "deltaQtyMilli", delta,
                "newQtyMilli", newQty
            )
        );

        return new StockItemDto(saved);
    }
}
