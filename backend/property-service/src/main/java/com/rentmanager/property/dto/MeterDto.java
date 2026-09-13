package com.rentmanager.property.dto;

import java.time.Instant;

public record MeterDto(
    String id,
    String code,
    String type,
    String unitLabel,
    String roomId,
    boolean isActive,
    Instant createdAt
) {}
