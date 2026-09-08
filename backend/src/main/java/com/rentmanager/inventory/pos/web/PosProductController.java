package com.rentmanager.inventory.pos.web;

import com.rentmanager.inventory.pos.dto.PosDtos.CreateProductRequest;
import com.rentmanager.inventory.pos.dto.PosDtos.UpdateProductRequest;
import com.rentmanager.inventory.pos.service.PosProductService;
import com.rentmanager.platform.security.AuthPrincipal;
import com.rentmanager.platform.security.CurrentUser;
import com.rentmanager.platform.web.ApiException;
import java.util.HashMap;
import java.util.Map;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

/** M14 POS product catalog, mirroring {@code src/app/api/pos/products/route.ts}. */
@RestController
@RequestMapping("/api/pos/products")
public class PosProductController {

  private final PosProductService products;
  private final CurrentUser currentUser;

  public PosProductController(PosProductService products, CurrentUser currentUser) {
    this.products = products;
    this.currentUser = currentUser;
  }

  @GetMapping
  public Map<String, Object> list() {
    return Map.of("products", products.list(currentUser.require()));
  }

  @PostMapping
  public ResponseEntity<Map<String, String>> create(@RequestBody CreateProductRequest body) {
    AuthPrincipal user = currentUser.require();
    if (body.price() == null) throw ApiException.validation("price is required");
    int priceMinor = (int) Math.round(body.price() * 100);
    String id = products.create(user, body.name(), priceMinor, body.category(), body.categoryId(),
        body.barcode(), body.sku(), body.description(), body.stockItemId());
    return ResponseEntity.status(HttpStatus.CREATED).body(Map.of("id", id));
  }

  @PatchMapping
  public Map<String, String> update(@RequestParam(required = false) String id,
      @RequestBody UpdateProductRequest body) {
    if (id == null || id.isBlank()) throw ApiException.validation("Product id query param is required");
    AuthPrincipal user = currentUser.require();
    Map<String, Boolean> present = new HashMap<>();
    present.put("name", body.name() != null);
    present.put("price", body.price() != null);
    present.put("category", body.category() != null);
    present.put("categoryId", body.categoryId() != null);
    present.put("sku", body.sku() != null);
    present.put("description", body.description() != null);
    present.put("isActive", body.isActive() != null);
    present.put("stockItemId", body.stockItemId() != null);
    Integer priceMinor = body.price() != null ? (int) Math.round(body.price() * 100) : null;
    String updated = products.update(user, id, present, body.name(), priceMinor, body.category(),
        body.categoryId(), body.barcode(), body.sku(), body.description(), body.isActive(),
        body.stockItemId());
    return Map.of("id", updated);
  }
}
