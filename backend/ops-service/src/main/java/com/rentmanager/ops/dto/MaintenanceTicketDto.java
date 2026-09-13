package com.rentmanager.ops.dto;

import java.time.Instant;

public record MaintenanceTicketDto(
    String id,
    String code,
    String propertyId,
    String roomId,
    String leaseId,
    String memberProfileId,
    String category,
    String priority,
    String status,
    String title,
    String description,
    String source,
    Instant slaDueAt,
    String assignedToId,
    Instant resolvedAt,
    Instant createdAt
) {}
