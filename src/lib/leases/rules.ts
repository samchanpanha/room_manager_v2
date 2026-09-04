/// Pure occupancy rules (INTENT.md M05): one active lease per bed; room
/// occupancy cannot exceed bed capacity; whole-room leases need the room free.
export interface LeaseRef {
  id: string;
  bedId: string | null; // null = whole-room lease
}

export type OccupancyCheck =
  | { ok: true }
  | { ok: false; code: "BED_TAKEN"; message: string }
  | { ok: false; code: "ROOM_FULL"; message: string }
  | { ok: false; code: "ROOM_NOT_MOVEIN_READY"; message: string }
  | { ok: false; code: "WHOLE_ROOM_CONFLICT"; message: string };

/// Rooms that can accept a move-in. Occupied rooms qualify in co-living
/// (a free bed in a shared room); cleaning/maintenance cannot.
export function isMoveInReady(roomStatus: string): boolean {
  return roomStatus === "vacant" || roomStatus === "reserved" || roomStatus === "occupied";
}

/// Validate a new lease placement against active leases in the same room.
/// `bedId === null` means the whole room is taken (requires zero active leases
/// and capacity ≥ 1).
export function checkPlacement(input: {
  roomStatus: string;
  capacity: number;
  activeLeases: LeaseRef[]; // currently active leases in this room (excluding the lease being validated)
  requestedBedId: string | null;
  existingBedIds?: string[]; // bed ids that exist in the room
}): OccupancyCheck {
  if (!isMoveInReady(input.roomStatus)) {
    return {
      ok: false,
      code: "ROOM_NOT_MOVEIN_READY",
      message: `Room status "${input.roomStatus}" — move-in requires vacant or reserved`
    };
  }
  const wholeRoomLease = input.activeLeases.find((l) => l.bedId === null);
  if (input.requestedBedId === null) {
    if (input.activeLeases.length > 0) {
      return {
        ok: false,
        code: "WHOLE_ROOM_CONFLICT",
        message: "A whole-room lease requires the room to have no other active leases"
      };
    }
    return { ok: true };
  }
  if (wholeRoomLease) {
    return {
      ok: false,
      code: "WHOLE_ROOM_CONFLICT",
      message: "Room is under a whole-room lease — no per-bed lease can be added"
    };
  }
  if (input.requestedBedId && input.existingBedIds && !input.existingBedIds.includes(input.requestedBedId)) {
    return { ok: false, code: "BED_TAKEN", message: "Requested bed does not exist in this room" };
  }
  const bedLease = input.activeLeases.find((l) => l.bedId === input.requestedBedId);
  if (bedLease) {
    return { ok: false, code: "BED_TAKEN", message: "This bed already has an active lease (one active lease per bed)" };
  }
  if (input.activeLeases.length + 1 > input.capacity) {
    return {
      ok: false,
      code: "ROOM_FULL",
      message: `Room capacity ${input.capacity} exceeded (${input.activeLeases.length} active lease(s))`
    };
  }
  return { ok: true };
}
