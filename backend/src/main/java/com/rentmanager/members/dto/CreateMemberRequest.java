package com.rentmanager.members.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.Size;
import java.util.List;

/** Mirrors the zod schema in src/app/api/members/route.ts. */
public record CreateMemberRequest(
    @NotBlank @Size(min = 2, max = 120) String name,
    String email,
    @Size(max = 40) String phone,
    @Size(max = 60) String nationality,
    @Size(max = 60) String idNumber,
    @Size(max = 80) String occupation,
    Double monthlyIncome,
    @Size(max = 500) String notes,
    String homePropertyId,
    @Valid @NotEmpty(message = "At least one emergency contact is required")
    List<EmergencyContactDto> emergencyContacts) {}
