package com.rentmanager.properties.service;

import java.util.Map;
import java.util.Set;

/**
 * Room status state machine (INTENT.md M00):
 * {@code vacant → reserved → occupied → cleaning → maintenance → vacant}.
 * Ports the allowed transitions from {@code src/lib/rooms/status.ts}.
 */
public final class RoomStatus {

  private RoomStatus() {}

  private static final Map<String, Set<String>> ALLOWED = Map.of(
      "vacant", Set.of("reserved", "occupied", "maintenance"),
      "reserved", Set.of("occupied", "vacant", "maintenance"),
      "occupied", Set.of("cleaning", "maintenance", "notice"),
      "cleaning", Set.of("vacant", "maintenance"),
      "maintenance", Set.of("vacant", "cleaning"),
      "notice", Set.of("cleaning", "occupied", "maintenance"));

  public static boolean canTransition(String from, String to) {
    if (from.equals(to)) return true;
    return ALLOWED.getOrDefault(from, Set.of()).contains(to);
  }
}
