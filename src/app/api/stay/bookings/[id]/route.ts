import { NextRequest } from "next/server";
import { z } from "zod";
import { clientIp, fail, ok, parseBody } from "@/lib/api";
import { getAuthUser } from "@/lib/auth/session";
import { hasModuleAccess } from "@/lib/rbac/can";
import { prisma } from "@/lib/db";
import { logAudit } from "@/lib/audit";
import { emitDomainEvent } from "@/lib/events";
import { extendBooking, getBooking } from "@/lib/operations/stay-service";

const patchSchema = z.object({
  checkOut: z.string().optional(),
  guests: z.coerce.number().int().positive().optional(),
  guestName: z.string().min(2).max(120).optional(),
  guestPhone: z.string().max(40).nullable().optional(),
  guestIdNumber: z.string().max(60).nullable().optional(),
  depositMinor: z.coerce.number().int().nonnegative().optional(),
  notes: z.string().max(500).nullable().optional()
});

export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const user = await getAuthUser();
  if (!user) return fail(401, "UNAUTHENTICATED", "Sign in required");
  if (!hasModuleAccess(user, "read", "M32")) return fail(403, "FORBIDDEN", "Missing permission M32:read");
  const { id } = await ctx.params;
  const booking = await getBooking(id);
  if (!booking) return fail(404, "NOT_FOUND", "Booking not found");
  return ok({ booking });
}

/// Pre-transition edits: late-checkout extension via the service machine, or
/// touch-only field updates (guests/contact/deposit/notes) while un-checked-in.
export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const ip = clientIp(req);
  const user = await getAuthUser();
  if (!user) return fail(401, "UNAUTHENTICATED", "Sign in required");
  if (!hasModuleAccess(user, "update", "M32")) return fail(403, "FORBIDDEN", "Missing permission M32:update");
  const { id } = await ctx.params;
  const parsed = await parseBody(req, patchSchema);
  if (parsed.response) return parsed.response;

  const existing = await getBooking(id);
  if (!existing) return fail(404, "NOT_FOUND", "Booking not found");

  // Interval extension rides the service state machine (availability + max).
  if (parsed.data.checkOut && new Date(parsed.data.checkOut).getTime() !== existing.checkOut.getTime()) {
    const ext = await extendBooking(id, new Date(parsed.data.checkOut), { id: user.id, name: user.name });
    if (!ext.ok) return fail(ext.code === "UNAVAILABLE" ? 409 : 400, ext.code, ext.message);
  }

  const data: Record<string, unknown> = {};
  if (parsed.data.guests !== undefined) data.guests = parsed.data.guests;
  if (parsed.data.guestName !== undefined) data.guestName = parsed.data.guestName;
  if (parsed.data.guestPhone !== undefined) data.guestPhone = parsed.data.guestPhone;
  if (parsed.data.guestIdNumber !== undefined) data.guestIdNumber = parsed.data.guestIdNumber;
  if (parsed.data.notes !== undefined) data.notes = parsed.data.notes;
  if (parsed.data.depositMinor !== undefined) {
    if (existing.status !== "requested" && existing.status !== "confirmed") {
      return fail(400, "INVALID_TRANSITION", "Deposit can only be changed before check-in");
    }
    if (parsed.data.depositMinor > existing.priceSnapshotMinor) {
      return fail(400, "DEPOSIT_EXCEEDS", `Deposit cannot exceed the quoted total of ${(existing.priceSnapshotMinor / 100).toFixed(2)}`);
    }
    data.depositMinor = parsed.data.depositMinor;
  }

  if (Object.keys(data).length > 0) {
    await prisma.stayBooking.update({ where: { id }, data });
    await logAudit({
      actorId: user.id,
      actorName: user.name,
      module: "M32",
      action: "update",
      entityType: "stay_booking",
      entityId: id,
      summary: `Stay ${existing.code} details updated`,
      propertyId: existing.propertyId,
      before: { guests: existing.guests, depositMinor: existing.depositMinor },
      after: data,
      ip
    });
    await emitDomainEvent("stay.booking_updated", { bookingId: id, code: existing.code, changed: Object.keys(data) }, existing.propertyId);
  }

  return ok({ id, updatedFields: Object.keys(data) });
}