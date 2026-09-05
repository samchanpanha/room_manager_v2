/// M32 Short-stay engine — rent modules (hourly / overnight / day-use) with
/// progressive duration-bucket pricing (a stay price is a pure function of the
/// interval + rate ladder), availability over stays AND active leases, walk-in
/// guest resolution to a MemberProfile, and a checkout that issues one
/// settlement invoice (F&B streams in via POS room_charge when posMode=tab).
/// Money flows through the existing M07 invoice + M09 payment stack.
import { prisma } from "@/lib/db";
import { logAudit } from "@/lib/audit";
import { emitDomainEvent } from "@/lib/events";
import { nextNumber } from "@/lib/numbering";
import { issueInvoice, recomputeAmountsTx, voidInvoice } from "@/lib/billing/service";
import { createPayment, confirmPayment, type ActorCtx } from "@/lib/payments/service";

type PrismaTx = Parameters<Parameters<typeof prisma.$transaction>[0]>[0];

const HEAVY_TX = { timeout: 20000, maxWait: 10000 } as const;

export const STAY_MINUTES = 60_000;
export const DAY_MINUTES = 1440;

export interface ConflictedStay {
  kind: "booking" | "lease";
  code: string;
  from: Date;
  to: Date | null;
}

export type StayResult<T> = { ok: true; data: T } | { ok: false; code: string; message: string; conflicts?: ConflictedStay[] };

// ─────────────────────────────────── Pricing ───────────────────────────────────

export interface RateBucket {
  id: string;
  toMinutes: number;
  priceMinor: number;
}

/// Progressive bucket price: the FIRST bucket whose coverage upper bound is ≥
/// the stay minutes wins (a 6h stay priced by the ≤12h bucket, cheaper than
/// 4h×2). Beyond the last bucket, bill whole days at the day price (the bucket
/// covering exactly 1440 min) plus the cheapest remainder bucket, or the next
/// whole day — whichever is cheaper (blended days).
export function progressiveBucketPrice(buckets: RateBucket[], minutes: number): number {
  if (buckets.length === 0) return 0;
  const hit = buckets.find((b) => minutes <= b.toMinutes);
  if (hit) return hit.priceMinor;
  const day = buckets.find((b) => b.toMinutes === DAY_MINUTES);
  if (!day) return buckets[buckets.length - 1].priceMinor;
  const n = Math.floor(minutes / DAY_MINUTES);
  const r = minutes - n * DAY_MINUTES;
  const remainder = r > 0 ? buckets.find((b) => r <= b.toMinutes)?.priceMinor ?? day.priceMinor : 0;
  return Math.min(n * day.priceMinor + remainder, (n + 1) * day.priceMinor);
}

/// Pick the rate ladder for (property, roomType) at a point in time. Most
/// specific scope wins as a SET: (property, roomType) → (property) →
/// (roomType) → global. Rules within the set keep effective-dating.
export async function resolveRateLadder(
  moduleId: string,
  propertyId: string | null,
  roomType: string | null,
  at: Date
): Promise<RateBucket[]> {
  const all = await prisma.stayRateRule.findMany({
    where: { moduleId, isActive: true, effectiveFrom: { lte: at } }
  });
  const current = (rs: typeof all, propertyId2: string | null, roomType2: string | null) =>
    rs
      .filter((r) => (r.propertyId ?? null) === propertyId2 && (r.roomType ?? null) === roomType2)
      .filter((r) => r.effectiveThrough === null || r.effectiveThrough > at)
      .sort((a, b) => a.toMinutes - b.toMinutes)
      .map((r) => ({ id: r.id, toMinutes: r.toMinutes, priceMinor: r.priceMinor }));

  for (const [pid, rt] of [
    [propertyId, roomType],
    [propertyId, null],
    [null, roomType],
    [null, null]
  ] as Array<[string | null, string | null]>) {
    const ladder = current(all, pid, rt);
    if (ladder.length > 0) return ladder;
  }
  return [];
}

export interface StayQuote {
  moduleId: string;
  roomId: string;
  roomNumber: string;
  roomType: string;
  checkIn: Date;
  checkOut: Date;
  guests: number;
  minutes: number;
  buckets: RateBucket[];
  strategy: string;
  totalMinor: number;
  dayPriceMinor: number;
}

/// Pure price probe — no writes. Validates the interval envelope and guest
/// count, resolves the ladder and computes the total.
export async function quoteStay(
  input: { moduleId: string; roomId: string; checkIn: Date; checkOut: Date; guests: number },
  at = new Date()
): Promise<StayResult<StayQuote>> {
  const mod = await prisma.rentModule.findUnique({ where: { id: input.moduleId } });
  if (!mod || !mod.isActive) return { ok: false, code: "MODULE_NOT_ACTIVE", message: "Rent module is missing or inactive" };
  const room = await prisma.room.findUnique({ where: { id: input.roomId }, include: { floor: { include: { building: { include: { property: true } } } } } });
  if (!room) return { ok: false, code: "NOT_FOUND", message: "Room not found" };

  const minutes = Math.round((input.checkOut.getTime() - input.checkIn.getTime()) / STAY_MINUTES);
  if (minutes <= 0 || input.checkIn >= input.checkOut) return { ok: false, code: "INVALID_INTERVAL", message: "checkOut must be after checkIn" };
  if (minutes < mod.minDurationMinutes) return { ok: false, code: "TOO_SHORT", message: `Minimum stay for ${mod.name} is ${Math.round(mod.minDurationMinutes / 60)}h` };
  if (minutes > mod.maxDurationMinutes) return { ok: false, code: "TOO_LONG", message: `Maximum stay for ${mod.name} is ${Math.round(mod.maxDurationMinutes / 60)}h` };
  if (input.guests < mod.minGuests || input.guests > mod.maxGuests) {
    return { ok: false, code: "GUEST_COUNT", message: `${mod.name} allows ${mod.minGuests}–${mod.maxGuests} guests` };
  }
  if (input.guests > room.capacity) return { ok: false, code: "ROOM_CAPACITY", message: `Room ${room.number} sleeps up to ${room.capacity}` };

  const buckets = await resolveRateLadder(mod.id, room.floor.building.property.id, room.type, at);
  if (buckets.length === 0) return { ok: false, code: "NO_RATES", message: "No active rate rules cover this room/module yet" };

  const totalMinor = progressiveBucketPrice(buckets, minutes);
  const day = buckets.find((b) => b.toMinutes === DAY_MINUTES);
  return {
    ok: true,
    data: {
      moduleId: mod.id,
      roomId: room.id,
      roomNumber: room.number,
      roomType: room.type,
      checkIn: input.checkIn,
      checkOut: input.checkOut,
      guests: input.guests,
      minutes,
      buckets,
      strategy: mod.billingStrategy,
      totalMinor,
      dayPriceMinor: day?.priceMinor ?? 0
    }
  };
}

// ─────────────────────────────── Availability ───────────────────────────────

/// Conflicts = overlapping active stays (requested/confirmed/checked_in) OR an
/// active lease covering the interval. Maintenance rooms are hard-blocked.
export async function checkAvailability(
  input: { roomId: string; checkIn: Date; checkOut: Date; excludeBookingId?: string }
): Promise<ConflictedStay[]> {
  const room = await prisma.room.findUnique({ where: { id: input.roomId }, select: { status: true } });
  const conflicts: ConflictedStay[] = [];
  if (room?.status === "maintenance") {
    conflicts.push({ kind: "booking", code: "ROOM_MAINTENANCE", from: input.checkIn, to: input.checkOut });
    return conflicts;
  }
  const [stays, leases] = await Promise.all([
    prisma.stayBooking.findMany({
      where: {
        roomId: input.roomId,
        status: { in: ["requested", "confirmed", "checked_in"] },
        id: { not: input.excludeBookingId },
        checkIn: { lt: input.checkOut },
        checkOut: { gt: input.checkIn }
      },
      select: { code: true, checkIn: true, checkOut: true }
    }),
    prisma.lease.findMany({
      where: { roomId: input.roomId, status: "active", startDate: { lt: input.checkOut }, OR: [{ endDate: null }, { endDate: { gt: input.checkIn } }] },
      select: { code: true, startDate: true, endDate: true }
    })
  ]);
  for (const s of stays) conflicts.push({ kind: "booking", code: s.code, from: s.checkIn, to: s.checkOut });
  for (const l of leases) conflicts.push({ kind: "lease", code: l.code, from: l.startDate, to: l.endDate });
  return conflicts;
}

// ─────────────────────────────── Guest resolution ───────────────────────────────

/// Walk-ins resolve to a MemberProfile: exact phone match first (so repeat
/// guests keep history + payments), otherwise a lightweight party+profile is
/// created. Returns the member id.
async function resolveGuestMember(
  guestName: string,
  guestPhone: string | null,
  homePropertyId: string | null
): Promise<{ id: string; created: boolean }> {
  const phone = guestPhone?.trim();
  if (phone) {
    const party = await prisma.party.findFirst({ where: { phone }, include: { memberProfiles: { where: { status: { not: "moved_out" } }, take: 1 } } });
    const member = party?.memberProfiles[0];
    if (member) return { id: member.id, created: false };
  }
  const member = await prisma.$transaction(async (tx) => {
    const party = await tx.party.create({ data: { type: "PERSON", name: guestName.trim(), phone: phone ?? null } });
    return tx.memberProfile.create({ data: { partyId: party.id, homePropertyId, status: "active" } });
  }, HEAVY_TX);
  return { id: member.id, created: true };
}

// ─────────────────────────────── Tab invoice ───────────────────────────────

const STAY_ACTIVE = ["requested", "confirmed", "checked_in"] as const;

/// Draft settlement invoice (one per booking, both modes — F&B streams into
/// this same invoice when posMode=tab). The placeholder code is replaced by a
/// gapless invoice number at issue time.
async function ensureTabInvoiceTx(tx: PrismaTx, bookingId: string, args: { propertyId: string; memberProfileId: string; checkIn: Date; checkOut: Date; createdById?: string | null }): Promise<string> {
  const existing = await tx.invoice.findUnique({ where: { stayBookingId: bookingId } });
  if (existing) return existing.id;
  const code = `STY-TAB-${bookingId.slice(-8)}`;
  const invoice = await tx.invoice.create({
    data: {
      code,
      propertyId: args.propertyId,
      memberProfileId: args.memberProfileId,
      status: "draft",
      periodStart: args.checkIn,
      periodEnd: args.checkOut,
      createdById: args.createdById ?? null,
      stayBookingId: bookingId
    }
  });
  return invoice.id;
}

/// POS room_charge tab streaming: append sale lines to the booking's open draft
/// invoice (no ledger posting — the 1300/4900 posting happens once at checkout
/// issue). idempotent per sale because posSale carries the invoice link.
export async function appendTabLinesTx(
  tx: PrismaTx,
  bookingId: string,
  args: { lines: Array<{ name: string; kind: string; qty: number; unitMinor: number; amountMinor: number }>; discountMinor?: number }
): Promise<string> {
  const booking = await tx.stayBooking.findUnique({ where: { id: bookingId }, include: { tabInvoice: true } });
  if (!booking) throw Object.assign(new Error("Booking not found"), { code: "NOT_FOUND" });
  if (booking.posMode !== "tab") throw Object.assign(new Error("Booking is not a tab"), { code: "NOT_TAB" });
  if (!STAY_ACTIVE.includes(booking.status as (typeof STAY_ACTIVE)[number])) {
    throw Object.assign(new Error(`Cannot stream to a ${booking.status} booking`), { code: "INVALID_STATE" });
  }
  const invoiceId =
    booking.tabInvoice?.id ?? (await ensureTabInvoiceTx(tx, bookingId, { propertyId: booking.propertyId, memberProfileId: booking.memberProfileId, checkIn: booking.checkIn, checkOut: booking.checkOut, createdById: booking.createdById }));
  await tx.invoiceItem.createMany({
    data: args.lines.map((l) => ({ invoiceId, kind: l.kind, name: l.name, qty: l.qty, unitMinor: l.unitMinor, amountMinor: l.amountMinor }))
  });
  if ((args.discountMinor ?? 0) > 0) {
    await tx.invoice.update({ where: { id: invoiceId }, data: { discountMinor: { increment: args.discountMinor } } });
  }
  await recomputeAmountsTx(tx, invoiceId);
  return invoiceId;
}

// ─────────────────────────────── Lifecycle ───────────────────────────────

export const STAY_STATUSES = ["requested", "confirmed", "checked_in", "checked_out", "no_show", "cancelled", "void"] as const;
export const STAY_MACHINE: Record<string, readonly string[]> = {
  requested: ["confirmed", "cancelled", "no_show", "void"],
  confirmed: ["checked_in", "cancelled", "no_show", "void"],
  checked_in: ["checked_out", "void"],
  checked_out: [],
  no_show: [],
  cancelled: [],
  void: []
};
function canTransitionStay(from: string, to: string): boolean {
  return STAY_MACHINE[from]?.includes(to) ?? false;
}
function assertStayTransition(from: string, to: string): void {
  if (!canTransitionStay(from, to)) {
    throw Object.assign(new Error(`Cannot move a ${from} booking to ${to}`), { code: "INVALID_TRANSITION" });
  }
}

export interface CreateBookingInput {
  moduleId: string;
  roomId: string;
  checkIn: Date;
  checkOut: Date;
  guests: number;
  guestName: string;
  guestPhone?: string;
  guestIdNumber?: string;
  memberProfileId?: string;
  depositMinor?: number;
  posMode?: "direct" | "tab";
  notes?: string;
}

export async function createBooking(input: CreateBookingInput, actor: ActorCtx): Promise<StayResult<{ id: string; code: string; priceSnapshotMinor: number; memberProfileId: string }>> {
  if (!input.guestName?.trim() || input.guestName.trim().length < 2) return { ok: false, code: "GUEST_NAME_REQUIRED", message: "Guest name is required" };
  const depositMinor = Math.max(0, input.depositMinor ?? 0);
  if (!Number.isInteger(depositMinor)) return { ok: false, code: "INVALID_DEPOSIT", message: "Deposit must be a whole minor-unit amount" };

  const quote = await quoteStay({ moduleId: input.moduleId, roomId: input.roomId, checkIn: input.checkIn, checkOut: input.checkOut, guests: input.guests }, new Date());
  if (!quote.ok) return quote;
  if (depositMinor > quote.data.totalMinor) return { ok: false, code: "DEPOSIT_EXCEEDS", message: `Deposit cannot exceed the quoted total of ${(quote.data.totalMinor / 100).toFixed(2)}` };

  const room = await prisma.room.findUnique({ where: { id: input.roomId }, include: { floor: { include: { building: { include: { property: true } } } } } });
  if (!room) return { ok: false, code: "NOT_FOUND", message: "Room not found" };
  const property = room.floor.building.property;

  const conflicts = await checkAvailability({ roomId: input.roomId, checkIn: input.checkIn, checkOut: input.checkOut });
  if (conflicts.length > 0) {
    return { ok: false, code: "UNAVAILABLE", message: "The room is already booked for part of this interval", conflicts };
  }

  const member =
    input.memberProfileId && (await prisma.memberProfile.findUnique({ where: { id: input.memberProfileId } }))
      ? { id: input.memberProfileId, created: false }
      : await resolveGuestMember(input.guestName, input.guestPhone ?? null, property.id);

  const year = new Date().getUTCFullYear();
  const code = await nextNumber("STAYBOOK", (n) => `STY-${year}-${String(n).padStart(4, "0")}`);

  const booking = await prisma.stayBooking.create({
    data: {
      code,
      moduleId: input.moduleId,
      roomId: input.roomId,
      propertyId: property.id,
      memberProfileId: member.id,
      guestName: input.guestName.trim(),
      guestPhone: input.guestPhone?.trim() ?? null,
      guestIdNumber: input.guestIdNumber?.trim() ?? null,
      checkIn: input.checkIn,
      checkOut: input.checkOut,
      guests: input.guests,
      status: "requested",
      priceSnapshotMinor: quote.data.totalMinor,
      dayPriceMinor: quote.data.dayPriceMinor,
      depositMinor,
      posMode: input.posMode ?? "direct",
      notes: input.notes?.trim() ?? null,
      createdById: actor.id
    },
    include: { module: true }
  });

  await logAudit({
    actorId: actor.auditActorId === undefined ? actor.id : actor.auditActorId,
    actorName: actor.name,
    module: "M32",
    action: "create",
    entityType: "stay_booking",
    entityId: booking.id,
    summary: `Stay ${booking.code} requested: ${room.number} (${booking.module.name}) ${booking.guestName} ${booking.checkIn.toISOString().slice(0, 16)}→${booking.checkOut.toISOString().slice(0, 16)} — ${(quote.data.totalMinor / 100).toFixed(2)}${depositMinor > 0 ? `, deposit ${(depositMinor / 100).toFixed(2)}` : ""}`,
    propertyId: property.id,
    after: { status: "requested", totalMinor: quote.data.totalMinor, guests: input.guests },
    ip: null
  });
  await emitDomainEvent("stay.booking_requested", { bookingId: booking.id, code: booking.code, room: room.number, memberId: member.id, totalMinor: quote.data.totalMinor }, property.id);

  return { ok: true, data: { id: booking.id, code: booking.code, priceSnapshotMinor: quote.data.totalMinor, memberProfileId: member.id } };
}

async function loadBooking(id: string) {
  return prisma.stayBooking.findUnique({
    where: { id },
    include: { room: { include: { floor: { include: { building: { include: { property: true } } } } } }, module: true, member: { include: { party: true } }, tabInvoice: true }
  });
}

/// Lock the booking + create its settlement invoice + mark the room reserved.
export async function confirmBooking(id: string, actor: ActorCtx): Promise<StayResult<{ id: string; totalMinor: number }>> {
  const booking = await loadBooking(id);
  if (!booking) return { ok: false, code: "NOT_FOUND", message: "Booking not found" };
  try {
    assertStayTransition(booking.status, "confirmed");
  } catch (e) {
    return { ok: false, code: (e as { code?: string }).code ?? "INVALID_TRANSITION", message: (e as Error).message };
  }
  const minutes = Math.round((booking.checkOut.getTime() - booking.checkIn.getTime()) / STAY_MINUTES);
  const buckets = await resolveRateLadder(booking.moduleId, booking.propertyId, booking.room.type, new Date());
  const totalMinor = progressiveBucketPrice(buckets, minutes);
  const conflicts = await checkAvailability({ roomId: booking.roomId, checkIn: booking.checkIn, checkOut: booking.checkOut, excludeBookingId: id });
  if (conflicts.length > 0) {
    return { ok: false, code: "UNAVAILABLE", message: "The room became unavailable — refresh and pick another interval", conflicts };
  }

  await prisma.$transaction(async (tx) => {
    await ensureTabInvoiceTx(tx, id, { propertyId: booking.propertyId, memberProfileId: booking.memberProfileId, checkIn: booking.checkIn, checkOut: booking.checkOut, createdById: booking.createdById });
    await tx.stayBooking.update({ where: { id }, data: { status: "confirmed", priceSnapshotMinor: totalMinor } });
    await tx.room.update({ where: { id: booking.roomId }, data: { status: "reserved" } });
  }, HEAVY_TX);

  await logAudit({
    actorId: actor.auditActorId === undefined ? actor.id : actor.auditActorId,
    actorName: actor.name,
    module: "M32",
    action: "confirm",
    entityType: "stay_booking",
    entityId: id,
    summary: `Stay ${booking.code} confirmed for ${booking.room.number} — ${(totalMinor / 100).toFixed(2)}`,
    propertyId: booking.propertyId,
    before: { status: booking.status },
    after: { status: "confirmed", totalMinor },
    ip: null
  });
  await emitDomainEvent("stay.booking_confirmed", { bookingId: id, code: booking.code, room: booking.room.number, totalMinor }, booking.propertyId);
  return { ok: true, data: { id, totalMinor } };
}

export async function checkInBooking(id: string, actor: ActorCtx): Promise<StayResult<{ id: string }>> {
  const booking = await loadBooking(id);
  if (!booking) return { ok: false, code: "NOT_FOUND", message: "Booking not found" };
  try {
    assertStayTransition(booking.status, "checked_in");
  } catch (e) {
    return { ok: false, code: (e as { code?: string }).code ?? "INVALID_TRANSITION", message: (e as Error).message };
  }
  const conflicts = await checkAvailability({ roomId: booking.roomId, checkIn: booking.checkIn, checkOut: booking.checkOut, excludeBookingId: id });
  if (conflicts.length > 0) {
    return { ok: false, code: "OVERLAP_AT_CHECKIN", message: "A lease or another stay now occupies this room — resolve first", conflicts };
  }
  await prisma.$transaction(async (tx) => {
    await tx.stayBooking.update({ where: { id }, data: { status: "checked_in" } });
    await tx.room.update({ where: { id: booking.roomId }, data: { status: "occupied" } });
  }, HEAVY_TX);

  await logAudit({
    actorId: actor.auditActorId === undefined ? actor.id : actor.auditActorId,
    actorName: actor.name,
    module: "M32",
    action: "checkin",
    entityType: "stay_booking",
    entityId: id,
    summary: `Stay ${booking.code} checked in — ${booking.room.number} now occupied`,
    propertyId: booking.propertyId,
    before: { status: booking.status },
    after: { status: "checked_in" },
    ip: null
  });
  await emitDomainEvent("stay.checked_in", { bookingId: id, code: booking.code, room: booking.room.number }, booking.propertyId);
  return { ok: true, data: { id } };
}

export interface CheckoutInput {
  payMethod: string;
  depositMethod?: string;
  extendTo?: Date;
}

export async function checkOutBooking(id: string, input: CheckoutInput, actor: ActorCtx, ip?: string | null): Promise<StayResult<{ id: string; invoiceId: string; totalMinor: number; depositAppliedMinor: number; paidMinor: number }>> {
  const booking = await loadBooking(id);
  if (!booking) return { ok: false, code: "NOT_FOUND", message: "Booking not found" };
  try {
    assertStayTransition(booking.status, "checked_out");
  } catch (e) {
    return { ok: false, code: (e as { code?: string }).code ?? "INVALID_TRANSITION", message: (e as Error).message };
  }
  const method = input.payMethod;
  if (!["cash", "qr", "card"].includes(method)) return { ok: false, code: "INVALID_METHOD", message: "payMethod must be cash | qr | card" };

  let checkOut = booking.checkOut;
  if (input.extendTo) {
    if (input.extendTo <= checkOut) return { ok: false, code: "INVALID_EXTENSION", message: "extendTo must be after the booked check-out" };
    const minutes = Math.round((input.extendTo.getTime() - booking.checkIn.getTime()) / STAY_MINUTES);
    if (minutes > booking.module.maxDurationMinutes) return { ok: false, code: "TOO_LONG", message: `Extended stay exceeds ${booking.module.name} max of ${Math.round(booking.module.maxDurationMinutes / 60)}h` };
    const tail = await checkAvailability({ roomId: booking.roomId, checkIn: booking.checkOut, checkOut: input.extendTo, excludeBookingId: id });
    if (tail.length > 0) return { ok: false, code: "UNAVAILABLE", message: "The extension window is already booked", conflicts: tail };
    checkOut = input.extendTo;
  }

  const minutes = Math.round((checkOut.getTime() - booking.checkIn.getTime()) / STAY_MINUTES);
  const buckets = await resolveRateLadder(booking.moduleId, booking.propertyId, booking.room.type, new Date());
  const totalMinor = progressiveBucketPrice(buckets, minutes);

  await prisma.$transaction(async (tx) => {
    const invoiceId = await ensureTabInvoiceTx(tx, id, { propertyId: booking.propertyId, memberProfileId: booking.memberProfileId, checkIn: booking.checkIn, checkOut, createdById: booking.createdById });
    const existing = await tx.invoiceItem.findFirst({ where: { invoiceId, kind: "rent" } });
    const rentLine = {
      name: `Room ${booking.room.number} — ${booking.module.name} (${formatStayDuration(minutes)})`,
      kind: "rent",
      qty: 1,
      unitMinor: totalMinor,
      amountMinor: totalMinor
    };
    if (existing) {
      await tx.invoiceItem.update({ where: { id: existing.id }, data: { ...rentLine } });
    } else {
      await tx.invoiceItem.create({ data: { invoiceId, ...rentLine } });
    }
    await tx.invoice.update({ where: { id: invoiceId }, data: { periodStart: booking.checkIn, periodEnd: checkOut } });
    await recomputeAmountsTx(tx, invoiceId);
    await tx.stayBooking.update({ where: { id }, data: { status: "checked_out", checkedOutAt: new Date(), checkOut, priceSnapshotMinor: totalMinor } });
    await tx.room.update({ where: { id: booking.roomId }, data: { status: "vacant" } });
    return invoiceId;
  }, HEAVY_TX);

  const invoiceId = (await prisma.stayBooking.findUniqueOrThrow({ where: { id }, select: { tabInvoice: { select: { id: true } } } })).tabInvoice?.id;
  if (!invoiceId) return { ok: false, code: "NO_INVOICE", message: "Settlement invoice missing — contact support" };

  const issued = await issueInvoice(invoiceId, actor, ip ?? null);
  if (!issued.ok) return { ok: false, code: issued.code, message: issued.message };

  const issuedInvoice = await prisma.invoice.findUniqueOrThrow({ where: { id: invoiceId }, select: { totalMinor: true } });
  const invoiceTotal = issuedInvoice.totalMinor;

  // Deposit → payment (receivedAt = check-in) then the full invoice balance,
  // which covers POS tab lines streamed onto the invoice while checked in.
  let depositAppliedMinor = 0;
  let paidMinor = 0;
  const depositMethod = input.depositMethod ?? method;
  const depositMinor = Math.min(booking.depositMinor, totalMinor);
  if (booking.depositMinor > 0 && depositMinor > 0) {
    const dep = await createPayment(actor, {
      memberProfileId: booking.memberProfileId,
      method: depositMethod,
      amountMinor: depositMinor,
      allocations: [{ invoiceId, amountMinor: depositMinor }],
      receivedAt: booking.checkIn
    });
    if (!dep.ok) return { ok: false, code: dep.code, message: `Deposit settlement failed: ${dep.message}` };
    const confirmed = await confirmPayment(dep.paymentId, actor, { ip: ip ?? null });
    if (!confirmed.ok) return { ok: false, code: confirmed.code, message: `Deposit confirmation failed: ${confirmed.message}` };
    depositAppliedMinor = depositMinor;
    paidMinor += depositMinor;
  }

  const balance = invoiceTotal - depositMinor;
  if (balance > 0) {
    const pay = await createPayment(actor, {
      memberProfileId: booking.memberProfileId,
      method,
      amountMinor: balance,
      allocations: [{ invoiceId, amountMinor: balance }]
    });
    if (!pay.ok) return { ok: false, code: pay.code, message: `Checkout settlement failed: ${pay.message}` };
    const confirmed = await confirmPayment(pay.paymentId, actor, { ip: ip ?? null });
    if (!confirmed.ok) return { ok: false, code: confirmed.code, message: `Checkout confirmation failed: ${confirmed.message}` };
    paidMinor += balance;
  }

  await logAudit({
    actorId: actor.auditActorId === undefined ? actor.id : actor.auditActorId,
    actorName: actor.name,
    module: "M32",
    action: "checkout",
    entityType: "stay_booking",
    entityId: id,
    summary: `Stay ${booking.code} checked out — ${(invoiceTotal / 100).toFixed(2)}${depositMinor > 0 ? ` (deposit ${(depositAppliedMinor / 100).toFixed(2)})` : ""} ${paidMinor > 0 ? `paid ${(paidMinor / 100).toFixed(2)} via ${method}` : ""}`,
    propertyId: booking.propertyId,
    before: { status: booking.status },
    after: { status: "checked_out", totalMinor: invoiceTotal, invoiceId },
    ip
  });
  await emitDomainEvent("stay.checked_out", { bookingId: id, code: booking.code, room: booking.room.number, totalMinor: invoiceTotal, invoiceId }, booking.propertyId);
  return { ok: true, data: { id, invoiceId, totalMinor: invoiceTotal, depositAppliedMinor, paidMinor } };
}

export async function cancelBooking(id: string, actor: ActorCtx): Promise<StayResult<{ id: string }>> {
  const booking = await loadBooking(id);
  if (!booking) return { ok: false, code: "NOT_FOUND", message: "Booking not found" };
  try {
    assertStayTransition(booking.status, "cancelled");
  } catch (e) {
    return { ok: false, code: (e as { code?: string }).code ?? "INVALID_TRANSITION", message: (e as Error).message };
  }
  await prisma.$transaction(async (tx) => {
    await tx.stayBooking.update({ where: { id }, data: { status: "cancelled" } });
    await tx.room.update({ where: { id: booking.roomId }, data: { status: "vacant" } });
    if (booking.tabInvoice && booking.tabInvoice.status === "draft") {
      await tx.invoiceItem.deleteMany({ where: { invoiceId: booking.tabInvoice.id } });
      await tx.invoice.delete({ where: { id: booking.tabInvoice.id } });
    }
  }, HEAVY_TX);
  await logAudit({
    actorId: actor.auditActorId === undefined ? actor.id : actor.auditActorId,
    actorName: actor.name,
    module: "M32",
    action: "cancel",
    entityType: "stay_booking",
    entityId: id,
    summary: `Stay ${booking.code} cancelled — ${booking.room.number} freed`,
    propertyId: booking.propertyId,
    before: { status: booking.status },
    after: { status: "cancelled" },
    ip: null
  });
  await emitDomainEvent("stay.booking_cancelled", { bookingId: id, code: booking.code, room: booking.room.number }, booking.propertyId);
  return { ok: true, data: { id } };
}

export async function noShowBooking(id: string, actor: ActorCtx): Promise<StayResult<{ id: string }>> {
  const booking = await loadBooking(id);
  if (!booking) return { ok: false, code: "NOT_FOUND", message: "Booking not found" };
  if (booking.status !== "requested" && booking.status !== "confirmed") {
    return { ok: false, code: "INVALID_TRANSITION", message: `Only requested/confirmed bookings can be marked no-show (is ${booking.status})` };
  }
  if (new Date() < booking.checkIn) return { ok: false, code: "NOT_YET", message: "Check-in time has not arrived yet" };
  await prisma.$transaction(async (tx) => {
    await tx.stayBooking.update({ where: { id }, data: { status: "no_show" } });
    await tx.room.update({ where: { id: booking.roomId }, data: { status: "vacant" } });
  }, HEAVY_TX);
  await logAudit({
    actorId: actor.auditActorId === undefined ? actor.id : actor.auditActorId,
    actorName: actor.name,
    module: "M32",
    action: "no_show",
    entityType: "stay_booking",
    entityId: id,
    summary: `Stay ${booking.code} marked no-show`,
    propertyId: booking.propertyId,
    before: { status: booking.status },
    after: { status: "no_show" },
    ip: null
  });
  return { ok: true, data: { id } };
}

export async function voidBooking(id: string, reason: string, actor: ActorCtx, ip?: string | null): Promise<StayResult<{ id: string }>> {
  const booking = await loadBooking(id);
  if (!booking) return { ok: false, code: "NOT_FOUND", message: "Booking not found" };
  if (!["requested", "confirmed", "checked_in"].includes(booking.status)) {
    return { ok: false, code: "INVALID_TRANSITION", message: `Cannot void a ${booking.status} booking` };
  }
  if (!reason?.trim()) return { ok: false, code: "REASON_REQUIRED", message: "A void reason is required" };

  await prisma.$transaction(async (tx) => {
    await tx.stayBooking.update({ where: { id }, data: { status: "void", voidReason: reason.trim() } });
    await tx.room.update({ where: { id: booking.roomId }, data: { status: "vacant" } });
    const inv = await tx.invoice.findUnique({ where: { stayBookingId: id } });
    if (inv && inv.status === "draft") {
      await tx.invoiceItem.deleteMany({ where: { invoiceId: inv.id } });
      await tx.invoice.delete({ where: { id: inv.id } });
    }
  }, HEAVY_TX);

  if (booking.tabInvoice && booking.tabInvoice.status !== "draft") {
    const vt = await voidInvoice(booking.tabInvoice.id, `Stay ${booking.code} void: ${reason.trim()}`, actor, ip ?? null);
    if (!vt.ok) return { ok: false, code: vt.code, message: vt.message };
  }

  await logAudit({
    actorId: actor.auditActorId === undefined ? actor.id : actor.auditActorId,
    actorName: actor.name,
    module: "M32",
    action: "void",
    entityType: "stay_booking",
    entityId: id,
    summary: `Stay ${booking.code} voided (${reason.trim()})`,
    propertyId: booking.propertyId,
    before: { status: booking.status },
    after: { status: "void", reason: reason.trim() },
    ip
  });
  return { ok: true, data: { id } };
}

export async function extendBooking(id: string, newCheckOut: Date, actor: ActorCtx): Promise<StayResult<{ id: string; totalMinor: number }>> {
  const booking = await loadBooking(id);
  if (!booking) return { ok: false, code: "NOT_FOUND", message: "Booking not found" };
  if (booking.status !== "confirmed" && booking.status !== "checked_in") {
    return { ok: false, code: "INVALID_TRANSITION", message: `Cannot extend a ${booking.status} booking` };
  }
  if (newCheckOut <= booking.checkOut) return { ok: false, code: "INVALID_EXTENSION", message: "New check-out must be after the current one" };
  const minutes = Math.round((newCheckOut.getTime() - booking.checkIn.getTime()) / STAY_MINUTES);
  if (minutes > booking.module.maxDurationMinutes) return { ok: false, code: "TOO_LONG", message: `Exceeds ${booking.module.name} max of ${Math.round(booking.module.maxDurationMinutes / 60)}h` };
  const tail = await checkAvailability({ roomId: booking.roomId, checkIn: booking.checkOut, checkOut: newCheckOut, excludeBookingId: id });
  if (tail.length > 0) return { ok: false, code: "UNAVAILABLE", message: "The extension window is already booked", conflicts: tail };

  const buckets = await resolveRateLadder(booking.moduleId, booking.propertyId, booking.room.type, new Date());
  const totalMinor = progressiveBucketPrice(buckets, minutes);
  await prisma.$transaction(async (tx) => {
    await tx.stayBooking.update({ where: { id }, data: { checkOut: newCheckOut, priceSnapshotMinor: totalMinor } });
    const inv = await tx.invoice.findUnique({ where: { stayBookingId: id } });
    if (inv) await tx.invoice.update({ where: { id: inv.id }, data: { periodEnd: newCheckOut } });
  }, HEAVY_TX);

  await logAudit({
    actorId: actor.auditActorId === undefined ? actor.id : actor.auditActorId,
    actorName: actor.name,
    module: "M32",
    action: "extend",
    entityType: "stay_booking",
    entityId: id,
    summary: `Stay ${booking.code} extended to ${newCheckOut.toISOString().slice(0, 16)} — ${(totalMinor / 100).toFixed(2)}`,
    propertyId: booking.propertyId,
    before: { checkOut: booking.checkOut },
    after: { checkOut: newCheckOut, totalMinor },
    ip: null
  });
  return { ok: true, data: { id, totalMinor } };
}

// ─────────────────────────────── Reads ───────────────────────────────

export function formatStayDuration(minutes: number): string {
  if (minutes < 60) return `${minutes}m`;
  if (minutes % DAY_MINUTES === 0) return `${minutes / DAY_MINUTES}d`;
  if (minutes % 60 === 0) return `${minutes / 60}h`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${h}h ${m}m`;
}

export async function listBookings(filters: { roomId?: string; status?: string; from?: Date; to?: Date }) {
  return prisma.stayBooking.findMany({
    where: {
      ...(filters.roomId ? { roomId: filters.roomId } : {}),
      ...(filters.status && filters.status !== "all" ? { status: filters.status } : {}),
      ...(filters.from || filters.to
        ? { checkIn: { ...(filters.from ? { gte: filters.from } : {}), ...(filters.to ? { lt: filters.to } : {}) } }
        : {})
    },
    include: { room: { select: { number: true, type: true } }, module: { select: { name: true } }, tabInvoice: { select: { id: true, code: true, status: true, totalMinor: true, amountDueMinor: true } } },
    orderBy: [{ checkIn: "desc" }]
  });
}

export async function getBooking(id: string) {
  return prisma.stayBooking.findUnique({
    where: { id },
    include: {
      room: { include: { floor: { include: { building: { include: { property: true } } } } } },
      module: true,
      member: { include: { party: true } },
      tabInvoice: { include: { items: true, allocations: { include: { payment: true } } } }
    }
  });
}

// ─────────────────────────────── Catalog CRUD │ Rates ───────────────────────────────

export async function listModules() {
  return prisma.rentModule.findMany({ include: { _count: { select: { bookings: true, rates: true } } }, orderBy: [{ sortOrder: "asc" }, { name: "asc" }] });
}

export async function createModule(input: { name: string; slug: string; billingStrategy?: string; minDurationMinutes?: number; maxDurationMinutes?: number; defaultDepositMinor?: number; minGuests?: number; maxGuests?: number; sortOrder?: number; propertyId?: string | null }, actor: ActorCtx): Promise<StayResult<{ id: string }>> {
  const slug = input.slug.trim().toLowerCase().replace(/\s+/g, "-");
  if (!slug) return { ok: false, code: "SLUG_REQUIRED", message: "Slug is required" };
  const dup = await prisma.rentModule.findUnique({ where: { slug } });
  if (dup) return { ok: false, code: "DUPLICATE", message: `A module with slug "${slug}" already exists` };
  const max = input.maxDurationMinutes ?? 1440;
  if ((input.minDurationMinutes ?? 120) >= max) return { ok: false, code: "INVALID_DURATION", message: "minDuration must be less than maxDuration" };
  const mod = await prisma.rentModule.create({ data: { ...input, slug, billingStrategy: input.billingStrategy ?? "progressive" } });
  await logAudit({ actorId: actor.id, actorName: actor.name, module: "M32", action: "create", entityType: "rent_module", entityId: mod.id, summary: `Rent module ${mod.name} created`, propertyId: mod.propertyId, after: { slug, minDurationMinutes: mod.minDurationMinutes, maxDurationMinutes: mod.maxDurationMinutes }, ip: null });
  return { ok: true, data: { id: mod.id } };
}

export async function updateModule(id: string, input: Partial<{ name: string; billingStrategy: string; minDurationMinutes: number; maxDurationMinutes: number; defaultDepositMinor: number; minGuests: number; maxGuests: number; sortOrder: number; isActive: boolean; propertyId: string | null }>, actor: ActorCtx): Promise<StayResult<{ id: string }>> {
  const existing = await prisma.rentModule.findUnique({ where: { id } });
  if (!existing) return { ok: false, code: "NOT_FOUND", message: "Module not found" };
  const max = input.maxDurationMinutes ?? existing.maxDurationMinutes;
  if ((input.minDurationMinutes ?? existing.minDurationMinutes) >= max) return { ok: false, code: "INVALID_DURATION", message: "minDuration must be less than maxDuration" };
  const mod = await prisma.rentModule.update({ where: { id }, data: { ...input, updatedAt: new Date() } });
  await logAudit({ actorId: actor.id, actorName: actor.name, module: "M32", action: "update", entityType: "rent_module", entityId: mod.id, summary: `Rent module ${mod.name} updated`, propertyId: mod.propertyId, after: input, ip: null });
  return { ok: true, data: { id: mod.id } };
}

export async function listRateRules(moduleId?: string) {
  const rules = await prisma.stayRateRule.findMany({
    where: moduleId ? { moduleId } : undefined,
    include: { module: { select: { name: true } } },
    orderBy: [{ moduleId: "asc" }, { toMinutes: "asc" }]
  });
  return rules;
}

export async function createRateRule(input: { moduleId: string; toMinutes: number; priceMinor: number; propertyId?: string | null; roomType?: string | null; effectiveFrom?: Date; effectiveThrough?: Date | null; isActive?: boolean }, actor: ActorCtx): Promise<StayResult<{ id: string }>> {
  const data_mod = await prisma.rentModule.findUnique({ where: { id: input.moduleId } });
  if (!data_mod) return { ok: false, code: "NOT_FOUND", message: "Module not found" };
  if (!Number.isInteger(input.toMinutes) || input.toMinutes <= 0) return { ok: false, code: "INVALID_BUCKET", message: "toMinutes must be a positive integer" };
  if (!Number.isInteger(input.priceMinor) || input.priceMinor <= 0) return { ok: false, code: "INVALID_PRICE", message: "priceMinor must be a positive integer" };
  const rule = await prisma.stayRateRule.create({
    data: {
      moduleId: input.moduleId,
      toMinutes: input.toMinutes,
      priceMinor: input.priceMinor,
      propertyId: input.propertyId ?? null,
      roomType: input.roomType ?? null,
      effectiveFrom: input.effectiveFrom ?? new Date(),
      effectiveThrough: input.effectiveThrough ?? null,
      isActive: input.isActive ?? true
    }
  });
  await logAudit({ actorId: actor.id, actorName: actor.name, module: "M32", action: "create", entityType: "stay_rate_rule", entityId: rule.id, summary: `Rate ${data_mod.name} ≤${Math.round(input.toMinutes / 60)}h = ${(input.priceMinor / 100).toFixed(2)} added`, propertyId: rule.propertyId, after: { toMinutes: input.toMinutes, priceMinor: input.priceMinor }, ip: null });
  return { ok: true, data: { id: rule.id } };
}

export async function updateRateRule(id: string, input: Partial<{ toMinutes: number; priceMinor: number; propertyId: string | null; roomType: string | null; effectiveFrom: Date; effectiveThrough: Date | null; isActive: boolean }>, actor: ActorCtx): Promise<StayResult<{ id: string }>> {
  const existing = await prisma.stayRateRule.findUnique({ where: { id } });
  if (!existing) return { ok: false, code: "NOT_FOUND", message: "Rate rule not found" };
  const rule = await prisma.stayRateRule.update({ where: { id }, data: { ...input, updatedAt: new Date() } });
  await logAudit({ actorId: actor.id, actorName: actor.name, module: "M32", action: "update", entityType: "stay_rate_rule", entityId: rule.id, summary: `Rate rule updated (≤${rule.toMinutes / 60}h → ${(rule.priceMinor / 100).toFixed(2)})`, propertyId: rule.propertyId, after: input, ip: null });
  return { ok: true, data: { id: rule.id } };
}

export async function deleteRateRule(id: string, actor: ActorCtx): Promise<StayResult<{ id: string }>> {
  const existing = await prisma.stayRateRule.findUnique({ where: { id } });
  if (!existing) return { ok: false, code: "NOT_FOUND", message: "Rate rule not found" };
  await prisma.stayRateRule.delete({ where: { id } });
  await logAudit({ actorId: actor.id, actorName: actor.name, module: "M32", action: "delete", entityType: "stay_rate_rule", entityId: id, summary: "Rate rule deleted", propertyId: existing.propertyId, ip: null });
  return { ok: true, data: { id } };
}