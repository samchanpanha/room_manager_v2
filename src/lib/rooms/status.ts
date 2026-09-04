/// Room status machine (INTENT.md §6). Enforced by the API and unit-tested.
export const ROOM_STATUSES = ["vacant", "reserved", "occupied", "cleaning", "maintenance"] as const;
export type RoomStatus = (typeof ROOM_STATUSES)[number];

export const ROOM_TRANSITIONS: Record<RoomStatus, RoomStatus[]> = {
  vacant: ["reserved", "occupied", "cleaning", "maintenance"],
  reserved: ["occupied", "vacant", "maintenance"],
  occupied: ["cleaning", "maintenance"],
  cleaning: ["vacant", "maintenance"],
  maintenance: ["vacant", "cleaning"]
};

export function isRoomStatus(v: string): v is RoomStatus {
  return (ROOM_STATUSES as readonly string[]).includes(v);
}

export function canTransition(from: RoomStatus, to: RoomStatus): boolean {
  return ROOM_TRANSITIONS[from].includes(to);
}

/// Rooms entering maintenance must carry a reason (audit trail).
export function transitionRequiresReason(to: RoomStatus): boolean {
  return to === "maintenance";
}
