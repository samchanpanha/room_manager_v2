package com.rentmanager.ops.dto;

import java.time.Instant;

public record ComplaintDto(
    String id,
    String code,
    String propertyId,
    String memberProfileId,
    String leaseId,
    String category,
    String priority,
    String source,
    String status,
    String subject,
    String description,
    Instant slaDueAt,
    String assignedToId,
    String ticketId,
    Instant resolvedAt,
    Instant createdAt
) {}
