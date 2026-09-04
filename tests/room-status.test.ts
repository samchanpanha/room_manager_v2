import { describe, expect, it } from "vitest";
import {
  ROOM_STATUSES,
  ROOM_TRANSITIONS,
  canTransition,
  isRoomStatus,
  transitionRequiresReason
} from "@/lib/rooms/status";

describe("Room status machine (INTENT.md §6)", () => {
  it("happy path: vacant → reserved → occupied → cleaning → maintenance → vacant", () => {
    expect(canTransition("vacant", "reserved")).toBe(true);
    expect(canTransition("reserved", "occupied")).toBe(true);
    expect(canTransition("occupied", "cleaning")).toBe(true);
    expect(canTransition("cleaning", "maintenance")).toBe(true);
    expect(canTransition("maintenance", "vacant")).toBe(true);
  });

  it("direct move-in: vacant → occupied is allowed", () => {
    expect(canTransition("vacant", "occupied")).toBe(true);
  });

  it("invalid transitions are rejected", () => {
    expect(canTransition("occupied", "vacant")).toBe(false); // must go through cleaning
    expect(canTransition("occupied", "reserved")).toBe(false);
    expect(canTransition("cleaning", "occupied")).toBe(false);
    expect(canTransition("vacant", "cleaning")).toBe(true); // preparing a vacant room is fine
    expect(canTransition("maintenance", "occupied")).toBe(false);
    expect(canTransition("reserved", "cleaning")).toBe(false);
  });

  it("every status has at least one exit (no dead ends)", () => {
    for (const s of ROOM_STATUSES) {
      expect(ROOM_TRANSITIONS[s].length).toBeGreaterThan(0);
    }
  });

  it("guards helpers", () => {
    expect(isRoomStatus("occupied")).toBe(true);
    expect(isRoomStatus("demolished")).toBe(false);
    expect(transitionRequiresReason("maintenance")).toBe(true);
    expect(transitionRequiresReason("cleaning")).toBe(false);
  });
});
