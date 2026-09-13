package com.rentmanager.ops.dto;

import java.time.Instant;

public record RoomMoveDto(
    String id,
    String code,
    String memberProfileId,
    String fromLeaseId,
    String toRoomId,
    Instant effectiveAt,
    String status,
    String requestedByRole,
    Instant createdAt
) {}
