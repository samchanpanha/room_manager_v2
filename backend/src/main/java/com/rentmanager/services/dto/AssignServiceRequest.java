package com.rentmanager.services.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import java.time.Instant;

/** Mirrors src/app/api/services/assignments/route.ts. */
public record AssignServiceRequest(
    @NotBlank String leaseId,
    @NotBlank String serviceId,
    Instant startDate,
    String parkingSlotCode,
    String wifiSsid,
    @Size(max = 300) String note) {}
