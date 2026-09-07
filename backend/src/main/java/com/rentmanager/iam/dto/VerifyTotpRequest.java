package com.rentmanager.iam.dto;

import jakarta.validation.constraints.NotBlank;

public record VerifyTotpRequest(
    @NotBlank String challenge,
    @NotBlank String code) {}
