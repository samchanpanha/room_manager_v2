package com.rentmanager.ops.dto;

import java.time.Instant;

public record InspectionDto(
    String id,
    String code,
    String type,
    String status,
    String leaseId,
    String roomId,
    String propertyId,
    Instant scheduledAt,
    Instant completedAt,
    Integer overallScore,
    String summaryNote,
    Instant createdAt
) {}
