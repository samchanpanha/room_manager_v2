package com.rentmanager.commerce.web;

import com.rentmanager.commerce.dto.AdjustStockRequest;
import com.rentmanager.commerce.dto.CreateStockItemRequest;
import com.rentmanager.commerce.dto.StockItemDto;
import com.rentmanager.commerce.service.StockService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/stock")
public class StockController {

    private final StockService stockService;

    public StockController(StockService stockService) {
        this.stockService = stockService;
    }

    @GetMapping
    public ResponseEntity<List<StockItemDto>> getInventoryByProperty(@RequestParam String propertyId) {
        return ResponseEntity.ok(stockService.getInventoryByProperty(propertyId));
    }

    @GetMapping("/{id}")
    public ResponseEntity<StockItemDto> getStockItem(@PathVariable String id) {
        return ResponseEntity.ok(stockService.getStockItem(id));
    }

    @PostMapping
    public ResponseEntity<StockItemDto> createStockItem(@Valid @RequestBody CreateStockItemRequest request) {
        StockItemDto created = stockService.createStockItem(request);
        return ResponseEntity.status(HttpStatus.CREATED).body(created);
    }

    @PostMapping("/{id}/adjust")
    public ResponseEntity<StockItemDto> adjustStock(
            @PathVariable String id,
            @Valid @RequestBody AdjustStockRequest request) {
        StockItemDto updated = stockService.adjustStock(id, request);
        return ResponseEntity.ok(updated);
    }
}
