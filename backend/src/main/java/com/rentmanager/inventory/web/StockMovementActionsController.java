package com.rentmanager.inventory.web;

import com.rentmanager.inventory.dto.StockDtos.ConsumeRequest;
import com.rentmanager.inventory.dto.StockDtos.PurchaseRequest;
import com.rentmanager.inventory.dto.StockDtos.TransferRequest;
import com.rentmanager.inventory.service.StockService;
import com.rentmanager.platform.security.AuthPrincipal;
import com.rentmanager.platform.security.CurrentUser;
import com.rentmanager.platform.web.ApiException;
import java.util.Map;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

/**
 * M15 stock movement actions — purchase (moving-average in), manual consumption,
 * and transfer between two items of one property. Mirrors
 * {@code /api/stock/{purchase,consume,transfer}}.
 */
@RestController
@RequestMapping("/api/stock")
public class StockMovementActionsController {

  private final StockService stock;
  private final CurrentUser currentUser;

  public StockMovementActionsController(StockService stock, CurrentUser currentUser) {
    this.stock = stock;
    this.currentUser = currentUser;
  }

  @PostMapping("/purchase")
  public ResponseEntity<Map<String, Integer>> purchase(@RequestBody PurchaseRequest body) {
    AuthPrincipal user = currentUser.require();
    if (body.stockItemId() == null || body.qty() == null || body.unitCost() == null) {
      throw ApiException.validation("stockItemId, qty and unitCost are required");
    }
    int qtyMilli = (int) Math.round(body.qty() * 1000);
    int unitCostMinor = (int) Math.round(body.unitCost() * 100);
    boolean inPacks = "pack".equalsIgnoreCase(body.unit());
    Map<String, Integer> data = stock.purchase(user, body.stockItemId(), qtyMilli, unitCostMinor,
        body.note(), inPacks);
    return ResponseEntity.status(HttpStatus.CREATED).body(data);
  }

  @PostMapping("/consume")
  public ResponseEntity<Map<String, Integer>> consume(@RequestBody ConsumeRequest body) {
    AuthPrincipal user = currentUser.require();
    if (body.stockItemId() == null || body.qty() == null) {
      throw ApiException.validation("stockItemId and qty are required");
    }
    int qtyMilli = (int) Math.round(body.qty() * 1000);
    int after = stock.consume(user, body.stockItemId(), qtyMilli, body.note());
    return ResponseEntity.status(HttpStatus.CREATED).body(Map.of("qtyAfterMilli", after));
  }

  @PostMapping("/transfer")
  public ResponseEntity<Map<String, Integer>> transfer(@RequestBody TransferRequest body) {
    AuthPrincipal user = currentUser.require();
    if (body.fromItemId() == null || body.toItemId() == null || body.qty() == null) {
      throw ApiException.validation("fromItemId, toItemId and qty are required");
    }
    int qtyMilli = (int) Math.round(body.qty() * 1000);
    Map<String, Integer> data = stock.transfer(user, body.fromItemId(), body.toItemId(), qtyMilli, body.note());
    return ResponseEntity.status(HttpStatus.CREATED).body(data);
  }
}
