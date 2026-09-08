package com.rentmanager.inventory.web;

import com.rentmanager.inventory.dto.StockDtos.StocktakeRequest;
import com.rentmanager.inventory.service.StockService;
import com.rentmanager.platform.security.AuthPrincipal;
import com.rentmanager.platform.security.CurrentUser;
import com.rentmanager.platform.web.ApiException;
import java.util.Map;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

/**
 * M15 stocktakes — count inventory and post an {@code adjustment} movement for
 * every variance ≠ 0. Mirrors {@code src/app/api/stock/stocktakes/route.ts}.
 */
@RestController
@RequestMapping("/api/stock/stocktakes")
public class StocktakeController {

  private final StockService stock;
  private final CurrentUser currentUser;

  public StocktakeController(StockService stock, CurrentUser currentUser) {
    this.stock = stock;
    this.currentUser = currentUser;
  }

  @GetMapping
  public Map<String, Object> list() {
    return Map.of("stocktakes", stock.listStocktakes(currentUser.require()));
  }

  @PostMapping
  public ResponseEntity<StockService.StocktakeResult> run(@RequestBody StocktakeRequest body) {
    AuthPrincipal user = currentUser.require();
    if (body.propertyId() == null || body.propertyId().isBlank()) {
      throw ApiException.validation("propertyId is required");
    }
    if (body.counted() == null || body.counted().isEmpty()) {
      throw ApiException.validation("At least one counted line is required");
    }
    StockService.StocktakeResult result =
        stock.runStocktake(user, body.propertyId(), body.note(), body.counted());
    return ResponseEntity.status(HttpStatus.CREATED).body(result);
  }
}
