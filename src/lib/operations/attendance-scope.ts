/// Read-scope resolution for M23 routes (§5 matrix: Staff = O(clock) —
/// property readers see the property, OWN holders see their own rows only).
import { can } from "@/lib/rbac/can";
import type { AuthUser } from "@/lib/auth/session";

export interface AttendanceScope {
  allowed: boolean;
  userId?: string; // set ⇒ restrict reads to this staff member
  own: boolean;
}

export function attendanceScope(user: AuthUser, propertyId: string): AttendanceScope {
  if (can(user, "read", "M23", { propertyId })) return { allowed: true, own: false };
  if (can(user, "read", "M23", { ownerUserId: user.id })) return { allowed: true, userId: user.id, own: true };
  return { allowed: false, own: true };
}
