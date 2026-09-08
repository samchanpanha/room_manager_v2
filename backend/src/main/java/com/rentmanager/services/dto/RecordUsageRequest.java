package com.rentmanager.services.dto;

import com.fasterxml.jackson.annotation.JsonProperty;
import com.fasterxml.jackson.databind.JsonNode;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import java.time.Instant;

/**
 * Mirrors src/app/api/services/usages/route.ts. {@code qty} arrives as a JSON
 * number (e.g. 2.5) or string; parsed into milli-units by the service.
 */
public record RecordUsageRequest(
    @NotBlank String leaseId,
    @NotBlank String serviceId,
    @JsonProperty("qty") JsonNode qtyNode,
    Instant usedAt,
    @Size(max = 300) String note) {

  /** Quantity as display-unit text ("2.5"), or null when absent. */
  public String qty() {
    return qtyNode == null || qtyNode.isNull() ? null : qtyNode.asText();
  }
}
