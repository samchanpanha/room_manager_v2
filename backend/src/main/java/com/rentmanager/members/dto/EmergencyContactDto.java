package com.rentmanager.members.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record EmergencyContactDto(
    @NotBlank @Size(min = 2, max = 120) String name,
    @NotBlank @Size(min = 2, max = 60) String relationship,
    @NotBlank @Size(min = 5, max = 40) String phone,
    String email,
    boolean isPrimary) {}
