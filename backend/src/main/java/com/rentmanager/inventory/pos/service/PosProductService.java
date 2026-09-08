package com.rentmanager.inventory.pos.service;

import com.rentmanager.inventory.domain.InventoryRepositories;
import com.rentmanager.inventory.domain.StockCategory;
import com.rentmanager.inventory.domain.StockItem;
import com.rentmanager.inventory.pos.domain.PosProduct;
import com.rentmanager.inventory.pos.domain.PosRepositories;
import com.rentmanager.kernel.audit.AuditEntry;
import com.rentmanager.kernel.audit.AuditService;
import com.rentmanager.kernel.tenant.TenantContext;
import com.rentmanager.platform.security.AuthPrincipal;
import com.rentmanager.platform.security.Rbdc;
import com.rentmanager.platform.web.ApiException;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * M14 POS product catalog CRUD, mirroring {@code src/app/api/pos/products/route.ts}.
 * A product optionally links an M15 {@link StockItem} so sales decrement on-hand;
 * barcodes are normalized to EAN-13 and kept unique. Category snapshots reuse the
 * M15 {@link StockCategory} tree (shared categories, {@code propertyId} null).
 * Photo upload/label printing (M17/print) are deferred; see the split plan.
 */
@Service
public class PosProductService {

  private final PosRepositories.Products products;
  private final InventoryRepositories.Categories categories;
  private final InventoryRepositories.Items stockItems;
  private final AuditService audit;

  public PosProductService(PosRepositories.Products products,
      InventoryRepositories.Categories categories, InventoryRepositories.Items stockItems,
      AuditService audit) {
    this.products = products;
    this.categories = categories;
    this.stockItems = stockItems;
    this.audit = audit;
  }

  public record ProductStock(String id, String name, int qtyMilli, String unit) {}

  public record ProductView(String id, String name, int priceMinor, String category,
      String categoryId, String barcode, String sku, String description, boolean isActive,
      ProductStock stock) {}

  @Transactional(readOnly = true)
  public List<ProductView> list(AuthPrincipal user) {
    if (!Rbdc.can(user, "read", "M14")) throw ApiException.forbidden("M14", "read");
    String tenantId = TenantContext.get();
    List<ProductView> out = new ArrayList<>();
    for (PosProduct p : products.findAllByOrderByNameAsc()) {
      ProductStock stock = null;
      if (p.getStockItemId() != null) {
        StockItem si = stockItems.findByIdAndTenantId(p.getStockItemId(), tenantId).orElse(null);
        if (si != null) stock = new ProductStock(si.getId(), si.getName(), si.getQtyMilli(), si.getUnit());
      }
      out.add(new ProductView(p.getId(), p.getName(), p.getPriceMinor(), p.getCategory(),
          p.getCategoryId(), p.getBarcode(), p.getSku(), p.getDescription(), p.isActive(), stock));
    }
    return out;
  }

  @Transactional
  public String create(AuthPrincipal user, String name, int priceMinor, String category,
      String categoryId, String rawBarcode, String sku, String description, String stockItemId) {
    if (!Rbdc.can(user, "create", "M14")) throw ApiException.forbidden("M14", "create");
    if (name == null || name.trim().length() < 2) {
      throw new ApiException(400, "NAME_REQUIRED", "Product name (2+ chars) is required");
    }
    if (priceMinor <= 0) throw new ApiException(400, "INVALID_PRICE", "price must be positive");
    String barcode = normalizeBarcode(rawBarcode);
    if (barcode != null && products.findByBarcode(barcode).isPresent()) {
      throw new ApiException(409, "BARCODE_TAKEN", "A product with barcode " + barcode + " already exists");
    }
    validateStockLink(stockItemId);
    ResolvedCategory rc = resolveCategory(categoryId, category);

    PosProduct product = new PosProduct(name.trim(), priceMinor);
    product.setCategory(rc.category());
    product.setCategoryId(rc.categoryId());
    product.setBarcode(barcode);
    product.setSku(blankToNull(sku));
    product.setDescription(blankToNull(description));
    product.setStockItemId(blankToNull(stockItemId));
    products.save(product);

    audit.log(AuditEntry.builder()
        .actorId(user.id()).actorName(user.name())
        .module("M14").action("pos_product.created").entityType("pos_product").entityId(product.getId())
        .summary("POS product \"" + product.getName() + "\" created @ "
            + String.format("%.2f", priceMinor / 100.0))
        .build());
    return product.getId();
  }

  @Transactional
  public String update(AuthPrincipal user, String id, Map<String, Boolean> present, String name,
      Integer priceMinor, String category, String categoryId, String rawBarcode, String sku,
      String description, Boolean isActive, String stockItemId) {
    if (!Rbdc.can(user, "update", "M14")) throw ApiException.forbidden("M14", "update");
    PosProduct product = products.findById(id)
        .orElseThrow(() -> ApiException.notFound("Product not found"));

    // barcode is (re)set on every PATCH, exactly as the Next route does.
    String barcode = normalizeBarcode(rawBarcode);
    if (barcode != null) {
      products.findByBarcode(barcode).filter(p -> !p.getId().equals(id)).ifPresent(p -> {
        throw new ApiException(409, "BARCODE_TAKEN", "A product with barcode " + barcode + " already exists");
      });
    }
    product.setBarcode(barcode);

    if (present.getOrDefault("name", false)) {
      if (name == null || name.trim().length() < 2) {
        throw new ApiException(400, "NAME_REQUIRED", "Product name (2+ chars) is required");
      }
      product.setName(name.trim());
    }
    if (present.getOrDefault("price", false)) {
      if (priceMinor == null || priceMinor <= 0) throw new ApiException(400, "INVALID_PRICE", "price must be positive");
      product.setPriceMinor(priceMinor);
    }
    if (present.getOrDefault("categoryId", false)) {
      ResolvedCategory rc = resolveCategory(categoryId, category);
      product.setCategoryId(rc.categoryId());
      product.setCategory(rc.category());
    } else if (present.getOrDefault("category", false)) {
      product.setCategory(blankToNull(category));
    }
    if (present.getOrDefault("sku", false)) product.setSku(blankToNull(sku));
    if (present.getOrDefault("description", false)) product.setDescription(blankToNull(description));
    if (present.getOrDefault("isActive", false) && isActive != null) product.setActive(isActive);
    if (present.getOrDefault("stockItemId", false)) {
      validateStockLink(stockItemId);
      product.setStockItemId(blankToNull(stockItemId));
    }
    products.save(product);

    audit.log(AuditEntry.builder()
        .actorId(user.id()).actorName(user.name())
        .module("M14").action("pos_product.updated").entityType("pos_product").entityId(product.getId())
        .summary("POS product \"" + product.getName() + "\" updated")
        .build());
    return product.getId();
  }

  // ---- helpers ------------------------------------------------------------

  private record ResolvedCategory(String categoryId, String category) {}

  private ResolvedCategory resolveCategory(String categoryId, String fallback) {
    if (categoryId != null && !categoryId.isBlank()) {
      StockCategory cat = categories.findById(categoryId).orElse(null);
      if (cat != null) {
        StockCategory parent = cat.getParentId() != null
            ? categories.findById(cat.getParentId()).orElse(null) : null;
        return new ResolvedCategory(cat.getId(),
            parent != null ? parent.getName() + "/" + cat.getName() : cat.getName());
      }
    }
    return new ResolvedCategory(null, blankToNull(fallback));
  }

  private void validateStockLink(String stockItemId) {
    if (stockItemId != null && !stockItemId.isBlank()
        && stockItems.findByIdAndTenantId(stockItemId, TenantContext.get()).isEmpty()) {
      throw ApiException.notFound("Linked stock item not found");
    }
  }

  /** EAN-13 normalize with a friendly 400 on malformed input (mirrors the route). */
  private static String normalizeBarcode(String raw) {
    if (raw == null || raw.trim().isEmpty()) return null;
    String digits = raw.replaceAll("\\D", "");
    if (digits.length() != 12 && digits.length() != 13) {
      throw new ApiException(400, "INVALID_BARCODE", "Barcode must be 12 or 13 digits (EAN-13)");
    }
    String normalized = Ean13.normalize(digits);
    if (normalized == null) {
      throw new ApiException(400, "INVALID_BARCODE", "Invalid EAN-13 barcode (check digit mismatch)");
    }
    return normalized;
  }

  private static String blankToNull(String v) {
    if (v == null) return null;
    String t = v.trim();
    return t.isEmpty() ? null : t;
  }
}
