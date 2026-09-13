package com.rentmanager.ops.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import java.time.Instant;

public record RequestRoomMoveRequest(
    @NotBlank(message = "Member profile ID is required")
    String memberProfileId,
    @NotBlank(message = "From lease ID is required")
    String fromLeaseId,
    @NotBlank(message = "To room ID is required")
    String toRoomId,
    @NotNull(message = "Effective date is required")
    Instant effectiveAt,
    String requestedByRole
) {}
