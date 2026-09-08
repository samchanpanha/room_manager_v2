package com.rentmanager.inventory.web;

import com.rentmanager.inventory.dto.StockDtos.CreateSupplierRequest;
import com.rentmanager.inventory.service.StockService;
import com.rentmanager.platform.security.AuthPrincipal;
import com.rentmanager.platform.security.CurrentUser;
import java.util.Map;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

/** M15 suppliers (global directory). Mirrors {@code src/app/api/stock/suppliers/route.ts}. */
@RestController
@RequestMapping("/api/stock/suppliers")
public class SupplierController {

  private final StockService stock;
  private final CurrentUser currentUser;

  public SupplierController(StockService stock, CurrentUser currentUser) {
    this.stock = stock;
    this.currentUser = currentUser;
  }

  @GetMapping
  public Map<String, Object> list() {
    return Map.of("suppliers", stock.listSuppliers(currentUser.require()));
  }

  @PostMapping
  public ResponseEntity<Map<String, String>> create(@RequestBody CreateSupplierRequest body) {
    AuthPrincipal user = currentUser.require();
    String id = stock.createSupplier(user, body.name(), body.phone(), body.email(), body.notes());
    return ResponseEntity.status(HttpStatus.CREATED).body(Map.of("id", id));
  }
}
