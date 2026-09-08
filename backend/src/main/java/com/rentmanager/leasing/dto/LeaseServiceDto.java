package com.rentmanager.leasing.dto;

import jakarta.validation.constraints.*;

public record LeaseServiceDto(
    @NotBlank @Size(min = 2, max = 80) String name,
    @NotNull @DecimalMin("0") @DecimalMax("100000") Double amount,
    @Pattern(regexp = "fixed_monthly|per_use|metered") String pricingModel) {

  public String pricingModel() {
    return pricingModel == null ? "fixed_monthly" : pricingModel;
  }
}
