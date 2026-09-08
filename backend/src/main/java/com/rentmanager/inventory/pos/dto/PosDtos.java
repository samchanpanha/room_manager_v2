package com.rentmanager.inventory.pos.dto;

import com.fasterxml.jackson.annotation.JsonProperty;
import java.util.List;

/**
 * Request DTOs for the M14 POS endpoints. Money/qty fields are major-unit on the
 * wire (matching the Next {@code /api/pos/*} routes: {@code float}, {@code qty},
 * {@code price}, {@code counted}); the controllers convert to minor/milli.
 * {@code discountMinor} is already minor on the wire, as in the Next schema.
 */
public final class PosDtos {

  private PosDtos() {}

  // ---- products -----------------------------------------------------------

  public record CreateProductRequest(String name, Double price, String category, String categoryId,
      String barcode, String sku, String description, String stockItemId) {}

  public record UpdateProductRequest(String name, Double price, String category, String categoryId,
      String barcode, String sku, String description, Boolean isActive, String stockItemId) {}

  // ---- sessions -----------------------------------------------------------

  public record OpenSessionRequest(String propertyId, @JsonProperty("float") Double openingFloat) {}

  public record CloseSessionRequest(Double counted, String note) {}

  // ---- sales --------------------------------------------------------------

  public record SaleLine(String productId, Double qty) {}

  public record RecordSaleRequest(String sessionId, String method, List<SaleLine> lines,
      String memberProfileId, String stayBookingId, String ref, Integer discountMinor,
      String discountLabel) {}
}
