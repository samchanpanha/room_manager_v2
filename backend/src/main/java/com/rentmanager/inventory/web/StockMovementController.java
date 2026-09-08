package com.rentmanager.inventory.web;

import com.rentmanager.inventory.service.StockService;
import com.rentmanager.platform.security.CurrentUser;
import org.springframework.web.bind.annotation.*;

/**
 * M15 movement history for one item — the only record of how on-hand changed.
 * Mirrors {@code src/app/api/stock/items/[id]/movements/route.ts}.
 */
@RestController
@RequestMapping("/api/stock/items/{id}/movements")
public class StockMovementController {

  private final StockService stock;
  private final CurrentUser currentUser;

  public StockMovementController(StockService stock, CurrentUser currentUser) {
    this.stock = stock;
    this.currentUser = currentUser;
  }

  @GetMapping
  public StockService.MovementHistory list(@PathVariable String id) {
    return stock.movementsFor(currentUser.require(), id);
  }
}
