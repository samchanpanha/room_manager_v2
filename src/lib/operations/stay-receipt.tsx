/// M32 stay checkout receipt: renders the PDF bytes and files them in the M17
/// DocumentRegistry (entity STAY_BOOKING, docType receipt) — same pattern as
/// the POS receipt in pos-service.tsx.
import { prisma } from "@/lib/db";
import { getSettings } from "@/lib/settings";
import { formatStayDuration, normalizeStrategy, priceBreakdown, resolveRateLadder, STAY_MINUTES } from "./stay-service";

export async function buildStayReceiptBytes(bookingId: string, copies = 1): Promise<Buffer> {
  const { renderToBuffer } = await import("@react-pdf/renderer");
  const { StayReceiptPdf } = await import("./stay-receipt-pdf");
  const booking = await prisma.stayBooking.findUnique({
    where: { id: bookingId },
    include: {
      room: { include: { floor: { include: { building: { include: { property: true } } } } } },
      module: true,
      member: { include: { party: true } },
      tabInvoice: { include: { items: true, allocations: { include: { payment: true } } } }
    }
  });
  if (!booking) throw new Error("Booking not found");
  const { org, printer, locale } = await getSettings();
  const payMethods = new Set<string>();
  let paidMinor = 0;
  let depositAppliedMinor = 0;
  const depositMinor = Math.min(booking.depositMinor, booking.priceSnapshotMinor);
  for (const alloc of booking.tabInvoice?.allocations ?? []) {
    paidMinor += alloc.amountMinor;
    payMethods.add(alloc.payment?.method ?? "cash");
    // Deposits are recorded at check-in; the rest at checkout.
    if (alloc.payment?.receivedAt && booking.checkIn.getTime() - alloc.payment.receivedAt.getTime() < 60_000) {
      depositAppliedMinor += alloc.amountMinor;
    }
  }
  depositAppliedMinor = Math.min(depositAppliedMinor, depositMinor);
  const rentLine = booking.tabInvoice?.items.find((i) => i.kind === "rent");
  const fbLines = (booking.tabInvoice?.items ?? []).filter((i) => i.kind !== "rent").map((i) => ({ name: i.name, amountMinor: i.amountMinor }));
  const minutes = Math.round((booking.checkOut.getTime() - booking.checkIn.getTime()) / STAY_MINUTES);
  const strategy = normalizeStrategy(booking.module.billingStrategy);
  const buckets = await resolveRateLadder(booking.moduleId, booking.propertyId, booking.room.type, booking.checkOut);
  const bd = priceBreakdown(buckets, minutes, strategy);
  let bucketLabel = "";
  if (bd.hitToMinutes > 0) bucketLabel = `≤${formatStayDuration(bd.hitToMinutes)} bucket`;
  else if (bd.dayCount > 0) bucketLabel = `${bd.dayCount} day(s)${bd.remainderMinutes > 0 ? ` + ≤${formatStayDuration(bd.remainderMinutes)} remainder` : ""}`;

  const primaryMethod = payMethods.has("cash") ? "cash" : payMethods.values().next().value ?? "cash";

  const buffer = await renderToBuffer(
    <StayReceiptPdf
      copies={copies}
      data={{
        code: booking.code,
        orgName: org.name ?? "RentManager",
        orgAddress: org.address || undefined,
        orgPhone: org.phone || undefined,
        orgTaxId: org.taxId || undefined,
        orgFooterNote: org.invoiceFooterNote || "Thank you!",
        printerWidthMm: printer.paperWidthMm ?? 58,
        propertyName: booking.room.floor.building.property.name,
        roomNumber: booking.room.number,
        moduleName: booking.module.name,
        guestName: booking.guestName,
        checkIn: booking.checkIn,
        checkOut: booking.checkOut,
        durationLabel: formatStayDuration(minutes),
        bucketLabel,
        rentMinor: rentLine?.amountMinor ?? booking.priceSnapshotMinor,
        lines: fbLines,
        subtotalMinor: booking.tabInvoice?.totalMinor ?? booking.priceSnapshotMinor,
        depositAppliedMinor,
        totalMinor: booking.tabInvoice?.totalMinor ?? booking.priceSnapshotMinor,
        paidMinor,
        payMethod: primaryMethod,
        invoiceCode: booking.tabInvoice?.code,
        currency: locale.currency ?? "USD",
        createdAt: new Date()
      }}
    />
  );
  return buffer;
}

/// Receipt PDF (M17 registry, entity STAY_BOOKING, docType receipt).
export async function fileStayReceipt(bookingId: string): Promise<void> {
  const buffer = await buildStayReceiptBytes(bookingId, 1);
  const existing = await prisma.documentRegistry.findFirst({ where: { entity: "STAY_BOOKING", entityId: bookingId, docTypeId: "receipt" } });
  if (existing) return;
  const booking = await prisma.stayBooking.findUnique({ where: { id: bookingId }, select: { code: true, propertyId: true } });
  if (!booking) throw new Error("Booking not found");
  const { randomBytes } = await import("node:crypto");
  const storageKey = randomBytes(16).toString("hex");
  const { storage } = await import("@/lib/storage");
  await storage.put(storageKey, buffer);
  await prisma.documentRegistry.create({
    data: {
      docTypeId: "receipt",
      entity: "STAY_BOOKING",
      entityId: bookingId,
      fileName: `receipt-${booking.code}.pdf`,
      mimeType: "application/pdf",
      sizeBytes: buffer.length,
      storageKey,
      version: 1,
      propertyId: booking.propertyId,
      notes: "Auto-generated stay checkout receipt"
    }
  });
}