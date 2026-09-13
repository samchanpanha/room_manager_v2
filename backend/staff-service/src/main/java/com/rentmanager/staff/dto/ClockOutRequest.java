package com.rentmanager.staff.dto;

import jakarta.validation.constraints.NotBlank;

public record ClockOutRequest(
    @NotBlank(message = "Attendance record ID is required")
    String recordId,
    Double lat,
    Double lng
) {}
