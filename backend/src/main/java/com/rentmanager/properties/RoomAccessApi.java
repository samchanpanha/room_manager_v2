package com.rentmanager.properties;

import com.rentmanager.kernel.tenant.TenantContext;
import com.rentmanager.properties.domain.Bed;
import com.rentmanager.properties.domain.PropertyRepositories;
import com.rentmanager.properties.domain.Room;
import com.rentmanager.properties.service.RoomStatus;
import com.rentmanager.platform.web.ApiException;
import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceContext;
import java.util.List;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Published API of the properties module for other modules that need to read a
 * room's placement facts and drive its status machine (e.g. leasing M05 on
 * activate/end). Keeps the properties {@code domain} internal.
 */
@Service
public class RoomAccessApi {

  private final PropertyRepositories.Rooms rooms;

  @PersistenceContext
  private EntityManager em;

  public RoomAccessApi(PropertyRepositories.Rooms rooms) {
    this.rooms = rooms;
  }

  /** Placement-relevant snapshot of a room. */
  public record RoomInfo(
      String id, String number, String status, int capacity, String propertyId, List<String> bedIds) {}

  @Transactional(readOnly = true)
  public RoomInfo getRoom(String roomId) {
    Room room = rooms.findByIdAndTenantId(roomId, TenantContext.get())
        .orElseThrow(() -> ApiException.notFound("Room not found"));
    return toInfo(room);
  }

  private RoomInfo toInfo(Room room) {
    // propertyId is resolved via Floor→Building for scope checks.
    String propertyId = (String) em.createNativeQuery(
            "SELECT b.\"propertyId\" FROM \"Floor\" f JOIN \"Building\" b ON b.id = f.\"buildingId\" "
                + "WHERE f.id = ?")
        .setParameter(1, roomFloorId(room))
        .getSingleResult();
    @SuppressWarnings("unchecked")
    List<String> bedIds = em.createQuery(
            "select b.id from Bed b where b.roomId = :rid and b.tenantId = :t", String.class)
        .setParameter("rid", room.getId())
        .setParameter("t", TenantContext.get())
        .getResultList();
    return new RoomInfo(room.getId(), room.getNumber(), room.getStatus(),
        room.getCapacity(), propertyId, bedIds);
  }

  private String roomFloorId(Room room) {
    return (String) em.createNativeQuery("SELECT \"floorId\" FROM \"Room\" WHERE id = ?")
        .setParameter(1, room.getId())
        .getSingleResult();
  }

  /** Check that a bed belongs to a room. */
  @Transactional(readOnly = true)
  public boolean bedBelongsToRoom(String bedId, String roomId) {
    Long n = (Long) em.createQuery(
            "select count(b) from Bed b where b.id = :bid and b.roomId = :rid and b.tenantId = :t")
        .setParameter("bid", bedId)
        .setParameter("rid", roomId)
        .setParameter("t", TenantContext.get())
        .getSingleResult();
    return n != null && n > 0;
  }

  /** Drive the room status machine (validated) — used by lease effects. */
  @Transactional
  public void setStatus(String roomId, String toStatus) {
    Room room = rooms.findByIdAndTenantId(roomId, TenantContext.get())
        .orElseThrow(() -> ApiException.notFound("Room not found"));
    if (!RoomStatus.canTransition(room.getStatus(), toStatus)) {
      throw ApiException.validation(
          "Illegal room status transition: " + room.getStatus() + " → " + toStatus);
    }
    room.setStatus(toStatus);
    rooms.save(room);
  }
}
