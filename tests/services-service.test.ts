/**
 * M12 Services (§M12 acceptance) — DB-backed tests against a disposable COPY
 * of the seeded database:
 *   DATABASE_URL=file:./test-billing.db npx vitest run tests/services-service.test.ts
 *
 * Golden flow: assign WiFi + parking to a lease → both appear on the next
 * generated invoice; suspend WiFi mid-month → prorated stop on the window;
 * per-use laundry → one-time line; parking slots are unique; ending the lease
 * releases the slot/WiFi.
 */
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/storage", () => ({
  storage: {
    put: vi.fn(async () => undefined),
    get: vi.fn(async () => Buffer.from("%PDF-fake")),
    delete: vi.fn(async () => undefined)
  }
}));

import { prisma } from "@/lib/db";
import { assignService, createService, recordUsage, suspendAssignment } from "@/lib/services/service";
import { activateLease, endLease } from "@/lib/leases/service";
import { generateInvoices } from "@/lib/billing/service";

let actor = { id: "", name: "" };
let lease2 = ""; // LSE-0002, activated inside the suite
let wifi = ""; // WIFI catalog id
let parking = ""; // PARK catalog id
let laundry = ""; // LAUNDRY catalog id

beforeAll(async () => {
  const root = await prisma.user.findFirstOrThrow({ where: { email: "root@demo.test" } });
  actor = { id: root.id, name: root.name };
  // Self-clean M12 tables (no append-only triggers here).
  await prisma.serviceUsage.deleteMany();
  await prisma.serviceAssignment.deleteMany();
  await prisma.leaseService.deleteMany(); // snapshots (incl. the seed WiFi row)
  await prisma.parkingSlot.updateMany({ data: { status: "free" } });
  await prisma.wifiAccount.updateMany({ data: { status: "free" } });
  await prisma.auditLog.deleteMany({ where: { module: "M12" } });
  await prisma.domainEvent.deleteMany({ where: { type: { startsWith: "service." } } });

  const catalog = await prisma.serviceCatalog.findMany();
  wifi = catalog.find((c) => c.code === "WIFI")!.id;
  parking = catalog.find((c) => c.code === "PARK")!.id;
  laundry = catalog.find((c) => c.code === "LAUNDRY")!.id;

  // Activate LSE-0002 (starts Oct 1 — pull the start back so the Sep cycle
  // generates invoices for it) and make sure the member is verified.
  const lease = await prisma.lease.findUniqueOrThrow({ where: { code: "LSE-0002" } });
  lease2 = lease.id;
  await prisma.memberProfile.update({ where: { id: lease.memberProfileId }, data: { status: "verified" } });
  await prisma.lease.update({ where: { id: lease.id }, data: { startDate: new Date("2026-08-20") } });
  const activated = await activateLease(lease.id);
  if (!activated.ok) throw new Error(`LSE-0002 activation failed: ${JSON.stringify(activated)}`);
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe("§M12: assign WiFi + parking → both appear on the invoice", () => {
  it("assigns WiFi and a parking slot (slot becomes assigned, WiFi activates)", async () => {
    const a1 = await assignService(lease2, { serviceId: wifi, startDate: new Date("2026-08-20T00:00:00Z"), wifiSsid: "demo-wifi-101" }, actor);
    expect(a1.ok).toBe(true);
    const a2 = await assignService(lease2, { serviceId: parking, startDate: new Date("2026-08-20T00:00:00Z"), parkingSlotCode: "P-A01" }, actor);
    expect(a2.ok).toBe(true);

    expect((await prisma.wifiAccount.findUniqueOrThrow({ where: { ssid: "demo-wifi-101" } })).status).toBe("assigned");
    expect((await prisma.parkingSlot.findUniqueOrThrow({ where: { code: "P-A01" } })).status).toBe("assigned");

    // The fixed_monthly assignments created billing snapshots.
    const snapshots = await prisma.leaseService.findMany({ where: { leaseId: lease2 } });
    expect(snapshots.map((s) => s.name).sort()).toEqual(["Parking (P-A01)", "WiFi"]);
  });

  it("rejects a second assignment on the same slot and the same WiFi account", async () => {
    const slot = await assignService(lease2, { serviceId: parking, parkingSlotCode: "P-A01" }, actor);
    expect(slot).toMatchObject({ ok: false, code: "SLOT_TAKEN" });
    const ssid = await assignService(lease2, { serviceId: wifi, wifiSsid: "demo-wifi-101" }, actor);
    expect(ssid).toMatchObject({ ok: false, code: "WIFI_TAKEN" });
  });

  it("records per-use and suspends WiFi mid-month BEFORE the cycle runs", async () => {
    const usage = await recordUsage(lease2, { serviceId: laundry, qty: 2.5, usedAt: new Date("2026-08-25T12:00:00Z") }, actor);
    expect(usage).toMatchObject({ ok: true, data: { amountMinor: 500 } }); // 2.5 kg × 200
    const wrong = await recordUsage(lease2, { serviceId: wifi, qty: 1 }, actor);
    expect(wrong).toMatchObject({ ok: false, code: "INVALID_PRICING" });

    const assignment = await prisma.serviceAssignment.findFirstOrThrow({
      where: { leaseId: lease2, serviceId: wifi },
      include: { wifiAccount: true }
    });
    const suspended = await suspendAssignment(assignment.id, new Date("2026-09-10T00:00:00Z"), actor);
    expect(suspended.ok).toBe(true);
    const wifiAccount = await prisma.wifiAccount.findUniqueOrThrow({ where: { ssid: "demo-wifi-101" } });
    expect(wifiAccount.status).toBe("suspended"); // §M12: WiFi suspends with the assignment

    const snapshot = await prisma.leaseService.findUniqueOrThrow({ where: { id: assignment.snapshotId! } });
    expect(snapshot.activeThrough?.toISOString().slice(0, 10)).toBe("2026-09-10");
  });

  it("generates invoices: WiFi prorated 9/30, Parking full, laundry one-time line (§M12 acceptance)", async () => {
    const summary = await generateInvoices(actor);
    expect(summary.generated).toBeGreaterThan(0);
    const invoices = await prisma.invoice.findMany({ where: { leaseId: lease2, isDeposit: false }, include: { items: true } });
    expect(invoices.length).toBeGreaterThan(0);
    const sep = invoices.find((i) => i.periodStart.getUTCMonth() === 8); // September cycle
    expect(sep).toBeDefined();
    const wifiLine = sep!.items.find((i) => i.name.startsWith("WiFi"))!;
    expect(wifiLine.kind).toBe("service");
    expect(wifiLine.amountMinor).toBe(450); // 1500 × 9/30 — prorated stop (§M12)
    expect(wifiLine.name).toContain("(prorated 9/30)");
    const parkingLine = sep!.items.find((i) => i.name.startsWith("Parking"))!;
    expect(parkingLine.amountMinor).toBe(3000); // full month — not suspended

    // The per-use entry rode the first generated cycle (the Aug 20 stub).
    const usageRow = await prisma.serviceUsage.findFirstOrThrow({ where: { leaseId: lease2 } });
    expect(usageRow.status).toBe("billed");
    expect(usageRow.invoiceItemId).not.toBeNull();
    const item = await prisma.invoiceItem.findUniqueOrThrow({ where: { id: usageRow.invoiceItemId! } });
    expect(item.kind).toBe("one_time");
    expect(item.amountMinor).toBe(500);
    expect(item.name).toContain("2.5 kg");
  });

  it("ending the lease releases the parking slot and ends assignments", async () => {
    // Settle open dues first (OPEN_DUES gate) — the deposit invoice is the only
    // open one for this member (isDeposit excluded from the gate? No: the gate
    // counts ALL open invoices — settle everything with one payment).
    const open = await prisma.invoice.findMany({
      where: { memberProfileId: (await prisma.lease.findUniqueOrThrow({ where: { id: lease2 } })).memberProfileId, status: { in: ["issued", "partial_paid", "overdue"] }, amountDueMinor: { gt: 0 } }
    });
    const owed = open.reduce((s, i) => s + i.amountDueMinor, 0);
    if (owed > 0) {
      const { createPayment, confirmPayment } = await import("@/lib/payments/service");
      const rec = await createPayment(actor, { memberProfileId: (await prisma.lease.findUniqueOrThrow({ where: { id: lease2 } })).memberProfileId, method: "cash", amountMinor: owed });
      expect(rec.ok).toBe(true);
      const conf = await confirmPayment((rec as { paymentId: string }).paymentId, actor);
      expect(conf.ok).toBe(true);
    }
    // M18 gate (§15 v1.1): the lease can only end with a completed move-out
    // inspection on file — create this suite's own (re-run safe).
    const mv = await prisma.inspection.create({
      data: {
        code: `INSP-TEST-SVC-${Date.now()}`,
        type: "move_out",
        status: "completed",
        leaseId: lease2,
        roomId: (await prisma.lease.findUniqueOrThrow({ where: { id: lease2 } })).roomId!,
        propertyId: (await prisma.lease.findUniqueOrThrow({ where: { id: lease2 } })).propertyId,
        completedAt: new Date(),
        overallScore: 100,
        items: "{}"
      }
    });
    await prisma.lease.update({ where: { id: lease2 }, data: { moveOutInspectionId: mv.id } });

    const ended = await endLease(lease2, "completed", null);
    expect(ended.ok).toBe(true);

    const slot = await prisma.parkingSlot.findUniqueOrThrow({ where: { code: "P-A01" } });
    expect(slot.status).toBe("free");
    const wifiAccount = await prisma.wifiAccount.findUniqueOrThrow({ where: { ssid: "demo-wifi-101" } });
    expect(wifiAccount.status).toBe("free"); // suspended → released on lease end
    const assignments = await prisma.serviceAssignment.findMany({ where: { leaseId: lease2 } });
    expect(assignments.every((a) => a.status === "ended")).toBe(true);
  });

  it("catalog creation validates pricing model and code uniqueness", async () => {
    const bad = await createService({ code: "GYM", name: "Gym", pricingModel: "subscription", price: 10 }, actor);
    expect(bad).toMatchObject({ ok: false, code: "INVALID_PRICING" });
    const dup = await createService({ code: "WIFI", name: "WiFi clone", pricingModel: "fixed_monthly", price: 10 }, actor);
    expect(dup).toMatchObject({ ok: false, code: "DUPLICATE_CODE" });
    const okOne = await createService({ code: "CLEAN", name: "Deep cleaning", pricingModel: "per_use", price: 2500, unitLabel: "session" }, actor);
    expect(okOne.ok).toBe(true);
  });
});
