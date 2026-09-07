package com.rentmanager.properties.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record CreatePropertyRequest(
    @NotBlank @Size(max = 40) String code,
    @NotBlank @Size(min = 2, max = 120) String name,
    @Size(max = 240) String address) {}
