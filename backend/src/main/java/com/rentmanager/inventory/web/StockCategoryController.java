package com.rentmanager.inventory.web;

import com.rentmanager.inventory.dto.StockDtos.CreateCategoryRequest;
import com.rentmanager.inventory.service.StockService;
import com.rentmanager.platform.security.AuthPrincipal;
import com.rentmanager.platform.security.CurrentUser;
import java.util.Map;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

/**
 * M15 category hierarchy (two levels) — shared (null property) plus each in-scope
 * property's own. Mirrors {@code src/app/api/stock/categories/route.ts}.
 */
@RestController
@RequestMapping("/api/stock/categories")
public class StockCategoryController {

  private final StockService stock;
  private final CurrentUser currentUser;

  public StockCategoryController(StockService stock, CurrentUser currentUser) {
    this.stock = stock;
    this.currentUser = currentUser;
  }

  @GetMapping
  public Map<String, Object> list() {
    return Map.of("categories", stock.listCategories(currentUser.require()));
  }

  @PostMapping
  public ResponseEntity<Map<String, String>> create(@RequestBody CreateCategoryRequest body) {
    AuthPrincipal user = currentUser.require();
    String id = stock.createCategory(user, body.name(), body.parentId(), body.propertyId());
    return ResponseEntity.status(HttpStatus.CREATED).body(Map.of("id", id));
  }
}
