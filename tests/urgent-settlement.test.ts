import { beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/storage", () => ({
  storage: {
    put: vi.fn(async () => undefined),
    get: vi.fn(async () => Buffer.from("%PDF-fake")),
    delete: vi.fn(async () => undefined)
  }
}));

import { prisma } from "@/lib/db";
import {
  getUrgentSettlementPreview,
  executeUrgentSettlement,
  startUrgentSettlementQr,
  completeUrgentSettlementAfterPayment
} from "@/lib/leases/urgent-settlement";
import { confirmPayment, GATEWAY_ACTOR } from "@/lib/payments/service";
import { depositRemaining } from "@/lib/deposits/service";

describe("Urgent Settlement & Fast-Track Checkout Service", () => {
  let actor: { id: string; name: string };
  let testLeaseId = "";
  let testMemberId = "";
  let testRoomId = "";

  beforeAll(async () => {
    const user = await prisma.user.findFirst({ where: { status: "active" } });
    if (!user) throw new Error("No active user found in db");
    actor = { id: user.id, name: user.name };

    const prop = await prisma.property.findFirstOrThrow();
    const building = await prisma.building.findFirstOrThrow({ where: { propertyId: prop.id } });
    const floor = await prisma.floor.findFirstOrThrow({ where: { buildingId: building.id } });
    const party = await prisma.party.create({
      data: {
        name: `Urgent Tenant ${Date.now()}`,
        email: `urgent.${Date.now()}@test.com`,
        type: "PERSON"
      }
    });
    const member = await prisma.memberProfile.create({
      data: {
        partyId: party.id,
        status: "active",
        homePropertyId: prop.id
      }
    });
    const room = await prisma.room.create({
      data: {
        floorId: floor.id,
        number: `U-${Date.now().toString().slice(-4)}`,
        status: "occupied",
        basePriceMinor: 50000
      }
    });
    const lease = await prisma.lease.create({
      data: {
        code: `LSE-URG-${Date.now().toString().slice(-4)}`,
        memberProfileId: member.id,
        roomId: room.id,
        propertyId: prop.id,
        status: "active",
        startDate: new Date("2026-08-01"),
        rentAmountMinor: 50000,
        billingCycleDay: 1,
        depositTotalMinor: 50000
      },
      include: { member: true, room: true }
    });

    testLeaseId = lease.id;
    testMemberId = lease.memberProfileId;
    testRoomId = lease.roomId;
  });

  it("calculates urgent settlement preview with open dues, unbilled rent and deposit", async () => {
    const res = await getUrgentSettlementPreview(testLeaseId, "2026-09-15");
    expect(res.ok).toBe(true);
    if (!res.ok) return;

    expect(res.data.lease.id).toBe(testLeaseId);
    expect(res.data.member.id).toBe(testMemberId);
    expect(res.data.totalGrossDueMinor).toBeGreaterThanOrEqual(0);
    expect(res.data.suggestedNetPayableMinor).toBeGreaterThanOrEqual(0);
  });

  it("rejects urgent settlement preview for invalid or draft leases", async () => {
    const res = await getUrgentSettlementPreview("non-existent-id");
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.code).toBe("NOT_FOUND");
    }
  });

  it("executes urgent settlement with direct payment, fast-track inspection and room release", async () => {
    // Get current preview
    const preview = await getUrgentSettlementPreview(testLeaseId, "2026-09-15");
    expect(preview.ok).toBe(true);
    if (!preview.ok) return;

    const totalDue = preview.data.totalGrossDueMinor + 5000; // adding $50 early exit fee

    const result = await executeUrgentSettlement(
      testLeaseId,
      {
        departureDate: "2026-09-15",
        reason: "Urgent personal job relocation",
        earlyTerminationFeeMinor: 5000,
        fastTrackInspection: true,
        settlementMode: "direct_pay",
        paymentMethod: "cash",
        amountPaidMinor: totalDue
      },
      actor
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.leaseStatus).toBe("terminated");
    expect(result.receiptCode).toBeDefined();

    // Verify lease status in database
    const updatedLease = await prisma.lease.findUniqueOrThrow({ where: { id: testLeaseId } });
    expect(updatedLease.status).toBe("terminated");
    expect(updatedLease.terminationReason).toContain("Urgent departure: Urgent personal job relocation");

    // Verify room flipped to cleaning
    const updatedRoom = await prisma.room.findUniqueOrThrow({ where: { id: testRoomId } });
    expect(updatedRoom.status).toBe("cleaning");

    // Verify member flipped to moved_out
    const updatedMember = await prisma.memberProfile.findUniqueOrThrow({ where: { id: testMemberId } });
    expect(updatedMember.status).toBe("moved_out");
  });

  it("rejects urgent settlement when departure reason is missing", async () => {
    // Find or create another active lease to test validation
    const prop = await prisma.property.findFirstOrThrow();
    const building = await prisma.building.findFirstOrThrow({ where: { propertyId: prop.id } });
    const floor = await prisma.floor.findFirstOrThrow({ where: { buildingId: building.id } });
    const party = await prisma.party.create({
      data: { name: "Validation Tenant", type: "PERSON" }
    });
    const member = await prisma.memberProfile.create({
      data: { partyId: party.id, status: "active", homePropertyId: prop.id }
    });
    const room = await prisma.room.create({
      data: { floorId: floor.id, number: `V-${Date.now().toString().slice(-4)}`, status: "occupied", basePriceMinor: 40000 }
    });
    const lease = await prisma.lease.create({
      data: {
        code: `LSE-VAL-${Date.now().toString().slice(-4)}`,
        memberProfileId: member.id,
        roomId: room.id,
        propertyId: prop.id,
        status: "active",
        startDate: new Date("2026-08-01"),
        rentAmountMinor: 40000,
        billingCycleDay: 1
      }
    });

    const result = await executeUrgentSettlement(
      lease.id,
      {
        reason: "",
        settlementMode: "zero_due"
      },
      actor
    );

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("REASON_REQUIRED");
    }
  });

  it("handles deposit offset settlement mode", async () => {
    const prop = await prisma.property.findFirstOrThrow();
    const building = await prisma.building.findFirstOrThrow({ where: { propertyId: prop.id } });
    const floor = await prisma.floor.findFirstOrThrow({ where: { buildingId: building.id } });
    const party = await prisma.party.create({
      data: { name: `Deposit Offset Tenant ${Date.now()}`, type: "PERSON" }
    });
    const member = await prisma.memberProfile.create({
      data: { partyId: party.id, status: "active", homePropertyId: prop.id }
    });
    const room = await prisma.room.create({
      data: { floorId: floor.id, number: `D-${Date.now().toString().slice(-4)}`, status: "occupied", basePriceMinor: 30000 }
    });
    const lease = await prisma.lease.create({
      data: {
        code: `LSE-DEP-${Date.now().toString().slice(-4)}`,
        memberProfileId: member.id,
        roomId: room.id,
        propertyId: prop.id,
        status: "active",
        startDate: new Date("2026-08-01"),
        rentAmountMinor: 30000,
        billingCycleDay: 1
      }
    });

    const result = await executeUrgentSettlement(
      lease.id,
      {
        departureDate: "2026-08-01", // no unbilled days
        reason: "Urgent departure with zero dues",
        fastTrackInspection: true,
        settlementMode: "zero_due"
      },
      actor
    );

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.leaseStatus).toBe("terminated");
    }
  });

  it("QR-first settlement: opens a pending QR for the full balance, confirms via webhook, then completes and terminates", async () => {
    const prop = await prisma.property.findFirstOrThrow();
    const building = await prisma.building.findFirstOrThrow({ where: { propertyId: prop.id } });
    const floor = await prisma.floor.findFirstOrThrow({ where: { buildingId: building.id } });
    const party = await prisma.party.create({
      data: { name: `QR Tenant ${Date.now()}`, email: `qr.${Date.now()}@test.com`, type: "PERSON" }
    });
    const member = await prisma.memberProfile.create({
      data: { partyId: party.id, status: "active", homePropertyId: prop.id }
    });
    const room = await prisma.room.create({
      data: { floorId: floor.id, number: `Q-${Date.now().toString().slice(-4)}`, status: "occupied", basePriceMinor: 60000 }
    });
    const lease = await prisma.lease.create({
      data: {
        code: `LSE-QR-${Date.now().toString().slice(-4)}`,
        memberProfileId: member.id,
        roomId: room.id,
        propertyId: prop.id,
        status: "active",
        startDate: new Date("2026-08-01"),
        rentAmountMinor: 60000,
        billingCycleDay: 1
      }
    });
    const openInvoice = await prisma.invoice.create({
      data: {
        code: `INV-QR-${Date.now().toString().slice(-4)}`,
        propertyId: prop.id,
        leaseId: lease.id,
        memberProfileId: member.id,
        status: "issued",
        periodStart: new Date("2026-08-01"),
        periodEnd: new Date("2026-09-01"),
        issuedAt: new Date(),
        dueDate: new Date("2026-09-01"),
        subtotalMinor: 60000,
        totalMinor: 60000,
        amountDueMinor: 60000
      }
    });

    // 1. Start the QR-first settlement → lease moves to notice, one pending
    // payment covers the whole balance, QR payload returned for display.
    const start = await startUrgentSettlementQr(
      lease.id,
      { departureDate: "2026-09-15", reason: "QR urgent departure", fastTrackInspection: true },
      actor
    );
    expect(start.ok).toBe(true);
    if (!start.ok) return;
    expect(start.awaitingPayment).toBe(true);
    expect(start.paymentId).toBeTruthy();
    // open Aug invoice (60,000) + prorated final rent Sep 1–15 (28,000).
    expect(start.qrAmountMinor).toBe(88000);
    expect(start.qrImageDataUrl).toBeTruthy();
    expect(start.qrString).toContain("devmock://");
    expect(start.leaseStatus).toBe("notice");

    // The lease must NOT be terminated before money arrives.
    expect((await prisma.lease.findUniqueOrThrow({ where: { id: lease.id } })).status).toBe("notice");

    // 2. Gateway confirms (webhook → confirmPayment, exactly-once).
    const conf = await confirmPayment(start.paymentId!, actor, { ip: "test" });
    expect(conf.ok).toBe(true);
    if (!conf.ok) return;
    expect(conf.paymentStatus).toBe("confirmed");
    expect(conf.receiptCode).toBeTruthy();

    // 3. Webhook continuation closes the lease now that dues are clear.
    const done = await completeUrgentSettlementAfterPayment(start.paymentId!, GATEWAY_ACTOR, "test");
    expect(done.ok).toBe(true);
    if (!done.ok) return;
    expect(done.leaseStatus).toBe("terminated");

    const updatedLease = await prisma.lease.findUniqueOrThrow({ where: { id: lease.id } });
    expect(updatedLease.status).toBe("terminated");
    expect((await prisma.room.findUniqueOrThrow({ where: { id: room.id } })).status).toBe("cleaning");
    expect((await prisma.invoice.findUniqueOrThrow({ where: { id: openInvoice.id } })).status).toBe("paid");
  });

  it("combo settlement: deposit offset covers part, cash payment clears the remaining net", async () => {
    const prop = await prisma.property.findFirstOrThrow();
    const building = await prisma.building.findFirstOrThrow({ where: { propertyId: prop.id } });
    const floor = await prisma.floor.findFirstOrThrow({ where: { buildingId: building.id } });
    const party = await prisma.party.create({
      data: { name: `Combo Tenant ${Date.now()}`, type: "PERSON" }
    });
    const member = await prisma.memberProfile.create({
      data: { partyId: party.id, status: "active", homePropertyId: prop.id }
    });
    const room = await prisma.room.create({
      data: { floorId: floor.id, number: `C-${Date.now().toString().slice(-4)}`, status: "occupied", basePriceMinor: 50000 }
    });
    const lease = await prisma.lease.create({
      data: {
        code: `LSE-CMB-${Date.now().toString().slice(-4)}`,
        memberProfileId: member.id,
        roomId: room.id,
        propertyId: prop.id,
        status: "active",
        startDate: new Date("2026-08-01"),
        rentAmountMinor: 50000,
        billingCycleDay: 1,
        depositTotalMinor: 50000
      }
    });

    // Hold the deposit (paid deposit invoice → liability 50,000).
    const depInvoice = await prisma.invoice.create({
      data: {
        code: `INV-DEP-CMB-${Date.now().toString().slice(-4)}`,
        propertyId: prop.id,
        memberProfileId: member.id,
        status: "paid",
        isDeposit: true,
        periodStart: new Date("2026-08-01"),
        periodEnd: new Date("2026-08-01"),
        issuedAt: new Date(),
        dueDate: new Date("2026-08-01"),
        subtotalMinor: 50000,
        totalMinor: 50000,
        amountPaidMinor: 50000,
        amountDueMinor: 0,
        items: { create: [{ kind: "deposit", name: "Security deposit", qty: 1, unitMinor: 50000, amountMinor: 50000 }] }
      }
    });
    const deposit = await prisma.deposit.create({
      data: {
        leaseId: lease.id,
        memberProfileId: member.id,
        propertyId: prop.id,
        requiredMinor: 50000,
        status: "held",
        invoiceId: depInvoice.id
      }
    });
    // Open August rent invoice (due).
    const openInvoice = await prisma.invoice.create({
      data: {
        code: `INV-RENT-CMB-${Date.now().toString().slice(-4)}`,
        propertyId: prop.id,
        leaseId: lease.id,
        memberProfileId: member.id,
        status: "issued",
        periodStart: new Date("2026-08-01"),
        periodEnd: new Date("2026-09-01"),
        issuedAt: new Date(),
        dueDate: new Date("2026-09-01"),
        subtotalMinor: 50000,
        totalMinor: 50000,
        amountDueMinor: 50000,
        items: { create: [{ kind: "rent", name: "Rent Aug", qty: 1, unitMinor: 50000, amountMinor: 50000 }] }
      }
    });

    const preview = await getUrgentSettlementPreview(lease.id, "2026-09-15");
    expect(preview.ok).toBe(true);
    if (!preview.ok) return;
    expect(preview.data.depositHeldMinor).toBe(50000);
    expect(preview.data.suggestedNetPayableMinor).toBe(preview.data.totalGrossDueMinor - 50000);

    const net = preview.data.suggestedNetPayableMinor;
    expect(net).toBeGreaterThan(0);

    const result = await executeUrgentSettlement(
      lease.id,
      {
        departureDate: "2026-09-15",
        reason: "Urgent combo departure",
        fastTrackInspection: true,
        settlementMode: "combo",
        paymentMethod: "cash",
        amountPaidMinor: net
      },
      actor
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.leaseStatus).toBe("terminated");
    expect(result.paymentCode).toBeTruthy();
    expect(result.receiptCode).toBeTruthy();

    // Deposit fully released, all invoices cleared, room released, member out.
    expect(await depositRemaining(deposit.id)).toBe(0);
    expect((await prisma.invoice.findUniqueOrThrow({ where: { id: openInvoice.id } })).status).toBe("paid");
    const finalInvoices = await prisma.invoice.findMany({
      where: { leaseId: lease.id, status: { not: "void" }, isDeposit: false }
    });
    expect(finalInvoices.every((i) => i.amountDueMinor === 0)).toBe(true);
    expect((await prisma.room.findUniqueOrThrow({ where: { id: room.id } })).status).toBe("cleaning");
    expect((await prisma.memberProfile.findUniqueOrThrow({ where: { id: member.id } })).status).toBe("moved_out");
  });
});
