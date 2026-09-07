package com.rentmanager.properties;

import com.rentmanager.kernel.tenant.TenantContext;
import com.rentmanager.properties.domain.Building;
import com.rentmanager.properties.domain.BuildingRepository;
import com.rentmanager.platform.web.ApiException;
import java.util.List;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Published API for building ownership, consumed by the owners module (M03) so
 * it does not touch the properties module's internals directly — keeping the
 * Spring Modulith boundary clean. Exposed as the {@code api} named interface of
 * the properties module.
 */
@Service
public class BuildingOwnershipApi {

  private final BuildingRepository buildings;

  public BuildingOwnershipApi(BuildingRepository buildings) {
    this.buildings = buildings;
  }

  /** A building's current ownerProfileId, or null when unassigned. */
  public record BuildingOwnership(String buildingId, String name, String ownerProfileId) {}

  @Transactional(readOnly = true)
  public BuildingOwnership ownership(String buildingId) {
    Building b = buildings.findByIdAndTenantId(buildingId, TenantContext.get())
        .orElseThrow(() -> ApiException.notFound("Building " + buildingId + " not found"));
    return new BuildingOwnership(b.getId(), b.getName(), b.getOwnerId());
  }

  /** Assign a set of (currently unowned) buildings to an owner profile. */
  @Transactional
  public void assignToOwner(List<String> buildingIds, String ownerProfileId) {
    String tenantId = TenantContext.get();
    for (String id : buildingIds) {
      Building b = buildings.findByIdAndTenantId(id, tenantId)
          .orElseThrow(() -> ApiException.notFound("Building " + id + " not found"));
      if (b.getOwnerId() != null) {
        throw new ApiException(409, "BUILDING_OWNED",
            b.getName() + " is already owned — unassign it first");
      }
      b.setOwnerId(ownerProfileId);
      buildings.save(b);
    }
  }
}
