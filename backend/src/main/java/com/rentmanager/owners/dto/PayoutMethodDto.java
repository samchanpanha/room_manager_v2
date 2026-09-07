package com.rentmanager.owners.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

/** Mirrors payoutSchema in src/app/api/owners/route.ts. */
public record PayoutMethodDto(
    @NotBlank @Pattern(regexp = "BANK|MOBILE_MONEY|CASH|OTHER") String kind,
    @Size(max = 120) String bankName,
    @NotBlank @Size(min = 2, max = 120) String accountName,
    @NotBlank @Size(min = 3, max = 60) String accountNumber) {}
