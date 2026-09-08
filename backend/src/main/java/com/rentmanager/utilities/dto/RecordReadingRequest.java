package com.rentmanager.utilities.dto;

import com.fasterxml.jackson.databind.JsonNode;
import java.time.Instant;

/**
 * Mirrors src/app/api/meters/[id]/readings/route.ts: either a manual reading
 * ({@code value}, accepted as a JSON number like 241.5 or a string "241.5") or
 * {@code estimate=true} to use the average of the last 3. {@code readAt}
 * defaults to now.
 */
public record RecordReadingRequest(
    JsonNode value, Boolean estimate, Instant readAt, String note) {

  /** Reading value as display-unit text, or null when absent (estimate mode). */
  public String valueText() {
    return value == null || value.isNull() ? null : value.asText();
  }
}
