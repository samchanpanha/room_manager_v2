package com.rentmanager.owners.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import java.util.List;

/** Mirrors createSchema in src/app/api/owners/route.ts. */
public record CreateOwnerRequest(
    @NotBlank @Size(min = 2, max = 120) String name,
    String email,
    @Size(max = 40) String phone,
    @Size(max = 120) String companyName,
    @Size(max = 500) String notes,
    @Valid PayoutMethodDto payoutMethod,
    List<String> buildingIds,
    @Valid PortalLoginDto portalLogin) {

  public List<String> buildingIds() {
    return buildingIds == null ? List.of() : buildingIds;
  }
}
