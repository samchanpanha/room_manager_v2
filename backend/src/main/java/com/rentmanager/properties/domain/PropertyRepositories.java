package com.rentmanager.properties.domain;

import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

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
    long countByPropertyIdAndTenantId(String propertyId, String tenantId);
  }

  public interface Floors extends JpaRepository<Floor, String> {
    List<Floor> findByBuildingIdAndTenantId(String buildingId, String tenantId);
  }

  public interface Rooms extends JpaRepository<Room, String> {
    List<Room> findByFloorIdAndTenantId(String floorId, String tenantId);
    Optional<Room> findByIdAndTenantId(String id, String tenantId);

    /**
     * Per-property room occupancy for the occupancy grid: returns
     * (propertyId, totalRooms, occupiedRooms). Walks Room→Floor→Building.
     */
    @Query(value = """
        SELECT b."propertyId" AS propertyId,
               COUNT(r.id) AS total,
               COUNT(*) FILTER (WHERE r.status = 'occupied') AS occupied
        FROM "Room" r
        JOIN "Floor" f ON f.id = r."floorId"
        JOIN "Building" b ON b.id = f."buildingId"
        WHERE r."tenantId" = :tenantId
        GROUP BY b."propertyId"
        """, nativeQuery = true)
    List<PropertyRoomStats> roomStatsByProperty(@Param("tenantId") String tenantId);
  }

  /** Projection for {@link Rooms#roomStatsByProperty}. */
  public interface PropertyRoomStats {
    String getPropertyId();
    long getTotal();
    long getOccupied();
  }
}
