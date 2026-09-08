package com.rentmanager.inventory.web;

import com.rentmanager.inventory.dto.StockDtos.CreateItemRequest;
import com.rentmanager.inventory.dto.StockDtos.UpdateItemRequest;
import com.rentmanager.inventory.service.StockService;
import com.rentmanager.platform.security.AuthPrincipal;
import com.rentmanager.platform.security.CurrentUser;
import com.rentmanager.platform.web.ApiException;
import java.util.Map;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

/**
 * M15 stock items + valuation, mirroring {@code src/app/api/stock/items/route.ts}.
 * {@code qty}/{@code minQty} are major-unit on the wire; the service works in milli.
 */
@RestController
@RequestMapping("/api/stock/items")
public class StockItemController {

  private final StockService stock;
  private final CurrentUser currentUser;

  public StockItemController(StockService stock, CurrentUser currentUser) {
    this.stock = stock;
    this.currentUser = currentUser;
  }

  /** Valuation report across every property the user can read (on-hand × moving avg). */
  @GetMapping
  public StockService.ValuationReport list() {
    return stock.valuationAllScoped(currentUser.require());
  }

  @PostMapping
  public ResponseEntity<Map<String, String>> create(@RequestBody CreateItemRequest body) {
    AuthPrincipal user = currentUser.require();
    if (body.propertyId() == null || body.propertyId().isBlank()) {
      throw ApiException.validation("propertyId is required");
    }
    Integer minQtyMilli = body.minQty() != null ? (int) Math.round(body.minQty() * 1000) : null;
    String id = stock.createItem(user, body.name(),
        body.category() != null ? body.category() : "other", body.categoryId(), body.unit(),
        body.packUnit(), body.packSize(), minQtyMilli, body.supplierId(), body.propertyId());
    return ResponseEntity.status(HttpStatus.CREATED).body(Map.of("id", id));
  }

  @PatchMapping
  public Map<String, String> update(@RequestParam(required = false) String id,
      @RequestBody UpdateItemRequest body) {
    if (id == null || id.isBlank()) throw ApiException.validation("Stock item id query param is required");
    AuthPrincipal user = currentUser.require();
    Integer minQtyMilli = body.minQty() != null ? (int) Math.round(body.minQty() * 1000) : null;
    String updated = stock.updateItem(user, id,
        body.name(), body.name() != null,
        body.categoryId(), body.categoryId() != null,
        body.unit(),
        body.packUnit(), body.packUnit() != null,
        body.packSize(), body.packSize() != null,
        minQtyMilli, body.supplierId(), body.supplierId() != null,
        body.isActive());
    return Map.of("id", updated);
  }
}
