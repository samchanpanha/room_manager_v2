package com.rentmanager.properties.service;

import com.rentmanager.kernel.audit.AuditEntry;
import com.rentmanager.kernel.audit.AuditService;
import com.rentmanager.properties.domain.Building;
import com.rentmanager.properties.domain.Floor;
import com.rentmanager.properties.domain.Property;
import com.rentmanager.properties.domain.PropertyRepositories;
import com.rentmanager.properties.domain.Room;
import com.rentmanager.platform.security.AuthPrincipal;
import com.rentmanager.platform.security.Rbdc;
import com.rentmanager.kernel.tenant.TenantContext;
import com.rentmanager.platform.web.ApiException;
import java.util.List;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Properties & Rooms use-cases (INTENT.md M04) — published API of the module.
 * Ports {@code src/app/api/properties|buildings|floors|rooms/*}.
 */
@Service
public class PropertyService {

  private final PropertyRepositories.Properties properties;
  private final PropertyRepositories.Buildings buildings;
  private final PropertyRepositories.Floors floors;
  private final PropertyRepositories.Rooms rooms;
  private final AuditService audit;

  public PropertyService(
      PropertyRepositories.Properties properties,
      PropertyRepositories.Buildings buildings,
      PropertyRepositories.Floors floors,
      PropertyRepositories.Rooms rooms,
      AuditService audit) {
    this.properties = properties;
    this.buildings = buildings;
    this.floors = floors;
    this.rooms = rooms;
    this.audit = audit;
  }

  @Transactional(readOnly = true)
  public List<Property> listProperties(AuthPrincipal user) {
    String scope = Rbdc.widestScope(user, "read", "M04");
    if (scope == null) throw ApiException.forbidden("M04", "read");
    List<Property> all = properties.findByTenantIdOrderByCode(TenantContext.get());
    if ("GLOBAL".equals(scope)) return all;
    if ("PROPERTY".equals(scope)) {
      return all.stream().filter(p -> user.propertyIds().contains(p.getId())).toList();
    }
    return List.of();
  }

  @Transactional(readOnly = true)
  public Property getProperty(AuthPrincipal user, String id) {
    Property p = properties.findByIdAndTenantId(id, TenantContext.get())
        .orElseThrow(() -> ApiException.notFound("Property not found"));
    if (!Rbdc.can(user, "read", "M04", Rbdc.ResourceRef.property(p.getId()))
        && !Rbdc.can(user, "read", "M04")) {
      throw ApiException.forbidden("M04", "read");
    }
    return p;
  }

  @Transactional
  public Property createProperty(AuthPrincipal user, String code, String name, String address) {
    if (!Rbdc.can(user, "create", "M04")) throw ApiException.forbidden("M04", "create");
    String tenantId = TenantContext.get();
    properties.findByCodeAndTenantId(code, tenantId).ifPresent(p -> {
      throw ApiException.duplicate("A property with this code already exists");
    });
    Property saved = properties.save(new Property(code, name, address, tenantId));
    audit.log(AuditEntry.builder()
        .actorId(user.id()).actorName(user.name())
        .module("M04").action("create").entityType("property").entityId(saved.getId())
        .summary("Created property " + code + " (" + name + ")").build());
    return saved;
  }

  @Transactional(readOnly = true)
  public List<Building> listBuildings(AuthPrincipal user, String propertyId) {
    getProperty(user, propertyId); // authorizes read on the property
    return buildings.findByPropertyIdAndTenantId(propertyId, TenantContext.get());
  }

  @Transactional(readOnly = true)
  public List<Floor> listFloors(AuthPrincipal user, String buildingId) {
    if (!Rbdc.hasModuleAccess(user, "read", "M04")) throw ApiException.forbidden("M04", "read");
    return floors.findByBuildingIdAndTenantId(buildingId, TenantContext.get());
  }

  @Transactional(readOnly = true)
  public List<Room> listRooms(AuthPrincipal user, String floorId) {
    if (!Rbdc.hasModuleAccess(user, "read", "M04")) throw ApiException.forbidden("M04", "read");
    return rooms.findByFloorIdAndTenantId(floorId, TenantContext.get());
  }

  /** Room status transition, guarded by the state machine (INTENT.md M00). */
  @Transactional
  public Room changeRoomStatus(AuthPrincipal user, String roomId, String toStatus) {
    if (!Rbdc.can(user, "update", "M04")) throw ApiException.forbidden("M04", "update");
    Room room = rooms.findByIdAndTenantId(roomId, TenantContext.get())
        .orElseThrow(() -> ApiException.notFound("Room not found"));
    String from = room.getStatus();
    if (!RoomStatus.canTransition(from, toStatus)) {
      throw ApiException.validation("Illegal room status transition: " + from + " → " + toStatus);
    }
    room.setStatus(toStatus);
    Room saved = rooms.save(room);
    audit.log(AuditEntry.builder()
        .actorId(user.id()).actorName(user.name())
        .module("M04").action("update").entityType("room").entityId(roomId)
        .summary("Room " + room.getNumber() + " status " + from + " → " + toStatus).build());
    return saved;
  }
}
