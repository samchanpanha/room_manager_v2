package com.rentmanager.utilities.dto;

import jakarta.validation.constraints.NotBlank;

/** CSV body for src/app/api/meters/[id]/readings/import: rows date,value[,note]. */
public record ImportReadingsRequest(@NotBlank String csv) {}
