package com.rentmanager.property.dto;

import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import java.time.Instant;

public record RecordMeterReadingRequest(
    @NotBlank(message = "Meter ID is required")
    String meterId,
    @Min(value = 0, message = "Meter reading value must be non-negative")
    int valueMilli,
    Instant readAt,
    boolean estimated,
    String note
) {}
