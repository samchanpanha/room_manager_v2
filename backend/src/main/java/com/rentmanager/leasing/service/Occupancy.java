package com.rentmanager.leasing.service;

import java.util.List;

/**
 * Pure occupancy rules (INTENT.md M05) — port of {@code src/lib/leases/rules.ts}:
 * one active lease per bed; room occupancy ≤ capacity; whole-room leases need
 * the room otherwise free.
 */
public final class Occupancy {

  private Occupancy() {}

  /** An active lease in the room: bedId null = whole-room. */
  public record LeaseRef(String id, String bedId) {}

  public record Check(boolean ok, String code, String message) {
    static Check pass() { return new Check(true, null, null); }
    static Check fail(String code, String message) { return new Check(false, code, message); }
  }

  public static boolean isMoveInReady(String roomStatus) {
    return "vacant".equals(roomStatus) || "reserved".equals(roomStatus) || "occupied".equals(roomStatus);
  }

  public static Check checkPlacement(String roomStatus, int capacity, List<LeaseRef> activeLeases,
      String requestedBedId, List<String> existingBedIds) {
    if (!isMoveInReady(roomStatus)) {
      return Check.fail("ROOM_NOT_MOVEIN_READY",
          "Room status \"" + roomStatus + "\" — move-in requires vacant or reserved");
    }
    boolean hasWholeRoom = activeLeases.stream().anyMatch(l -> l.bedId() == null);
    if (requestedBedId == null) {
      if (!activeLeases.isEmpty()) {
        return Check.fail("WHOLE_ROOM_CONFLICT",
            "A whole-room lease requires the room to have no other active leases");
      }
      return Check.pass();
    }
    if (hasWholeRoom) {
      return Check.fail("WHOLE_ROOM_CONFLICT",
          "Room is under a whole-room lease — no per-bed lease can be added");
    }
    if (existingBedIds != null && !existingBedIds.contains(requestedBedId)) {
      return Check.fail("BED_TAKEN", "Requested bed does not exist in this room");
    }
    boolean bedTaken = activeLeases.stream().anyMatch(l -> requestedBedId.equals(l.bedId()));
    if (bedTaken) {
      return Check.fail("BED_TAKEN", "This bed already has an active lease (one active lease per bed)");
    }
    if (activeLeases.size() + 1 > capacity) {
      return Check.fail("ROOM_FULL",
          "Room capacity " + capacity + " exceeded (" + activeLeases.size() + " active lease(s))");
    }
    return Check.pass();
  }
}
