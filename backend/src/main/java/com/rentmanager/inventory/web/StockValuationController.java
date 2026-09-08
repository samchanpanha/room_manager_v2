package com.rentmanager.inventory.web;

import com.rentmanager.inventory.service.StockService;
import com.rentmanager.platform.security.AuthPrincipal;
import com.rentmanager.platform.security.CurrentUser;
import com.rentmanager.platform.web.ApiException;
import org.springframework.web.bind.annotation.*;

/**
 * M15 acceptance report — per-property on-hand × moving average + low-stock.
 * Mirrors {@code src/app/api/stock/valuation/route.ts}. Defaults to the user's
 * first assigned property when {@code propertyId} is omitted.
 */
@RestController
@RequestMapping("/api/stock/valuation")
public class StockValuationController {

  private final StockService stock;
  private final CurrentUser currentUser;

  public StockValuationController(StockService stock, CurrentUser currentUser) {
    this.stock = stock;
    this.currentUser = currentUser;
  }

  @GetMapping
  public StockService.ValuationReport valuation(@RequestParam(required = false) String propertyId) {
    AuthPrincipal user = currentUser.require();
    String requested = propertyId != null && !propertyId.isBlank()
        ? propertyId
        : (user.propertyIds().isEmpty() ? null : user.propertyIds().get(0));
    if (requested == null) {
      return new StockService.ValuationReport(java.util.List.of(), 0, 0);
    }
    return stock.valuation(user, requested);
  }
}
