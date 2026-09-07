package com.rentmanager.properties.domain;

import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

/** Repositories for the properties module (grouped for brevity). */
public final class PropertyRepositories {
  private PropertyRepositories() {}

  public interface Properties extends JpaRepository<Property, String> {
    List<Property> findByTenantIdOrderByCode(String tenantId);
    Optional<Property> findByIdAndTenantId(String id, String tenantId);
    Optional<Property> findByCodeAndTenantId(String code, String tenantId);
  }

  public interface Buildings extends JpaRepository<Building, String> {
    List<Building> findByPropertyIdAndTenantId(String propertyId, String tenantId);
  }

  public interface Floors extends JpaRepository<Floor, String> {
    List<Floor> findByBuildingIdAndTenantId(String buildingId, String tenantId);
  }

  public interface Rooms extends JpaRepository<Room, String> {
    List<Room> findByFloorIdAndTenantId(String floorId, String tenantId);
    Optional<Room> findByIdAndTenantId(String id, String tenantId);
  }
}
