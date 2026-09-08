package com.rentmanager.inventory.dto;

import java.util.List;

/**
 * Request DTOs for the inventory module (INTENT.md M15). Quantities/costs are
 * major-unit doubles on the wire (matching the Next {@code /api/stock/*} routes,
 * e.g. {@code qty}, {@code unitCost}, {@code minQty}); the controllers convert
 * them to integer milli / minor before calling the service.
 */
public final class StockDtos {

  private StockDtos() {}

  // ---- items --------------------------------------------------------------

  public record CreateItemRequest(String name, String category, String categoryId, String unit,
      String packUnit, Integer packSize, Double minQty, String supplierId, String propertyId) {}

  public record UpdateItemRequest(String name, String categoryId, String unit, String packUnit,
      Integer packSize, Double minQty, String supplierId, Boolean isActive) {}

  // ---- movements ----------------------------------------------------------

  /** {@code unit}: "base" (default) or "pack" (buys in the item's pack unit). */
  public record PurchaseRequest(String stockItemId, Double qty, Double unitCost, String unit,
      String note) {}

  public record ConsumeRequest(String stockItemId, Double qty, String note) {}

  public record TransferRequest(String fromItemId, String toItemId, Double qty, String note) {}

  // ---- stocktake ----------------------------------------------------------

  public record CountedLine(String stockItemId, Double counted) {}

  public record StocktakeRequest(String propertyId, String note, List<CountedLine> counted) {}

  // ---- categories / suppliers --------------------------------------------

  public record CreateCategoryRequest(String name, String parentId, String propertyId) {}

  public record CreateSupplierRequest(String name, String phone, String email, String notes) {}
}
