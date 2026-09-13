package com.rentmanager.staff.dto;

import java.time.Instant;

public record AttendanceRecordDto(
    String id,
    String userId,
    String propertyId,
    Instant workDate,
    Instant clockInAt,
    Instant clockOutAt,
    Integer minutesWorked,
    String source,
    Instant createdAt
) {}
