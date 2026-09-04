/**
 * M11 Utilities service (§M11 acceptance) — DB-backed tests against a
 * disposable COPY of the seeded database:
 *   DATABASE_URL=file:./test-billing.db npx vitest run tests/utilities-service.test.ts
 *
 * Golden flow: readings for rooms → pending charges → generateInvoices folds
 * them into the lease's next invoice as `utility` lines (charge = (reading −
 * previous) × tariff) → voiding that invoice reverts the charges to pending.
 * This suite runs LAST (alphabetical) — its leftovers affect nothing, and it
 * cleans its own tables first to stay re-runnable.
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
import { importReadingsCsv, recordReading, revertChargesForInvoice, upsertTariff } from "@/lib/utilities/service";
import { generateInvoices, voidInvoice } from "@/lib/billing/service";
import { activateLease } from "@/lib/leases/service";
import { formatMilli } from "@/lib/utilities/machines";

let actor = { id: "", name: "" };
let meter1 = ""; // fixture lease's room (active lease)
let meterVacant = ""; // room without an active lease
let propertyId = "";
let fixtureLease = "";

beforeAll(async () => {
  const root = await prisma.user.findFirstOrThrow({ where: { email: "root@demo.test" } });
  actor = { id: root.id, name: root.name };
  // Self-clean: meters/readings/charges are suite-owned (no triggers on them).
  await prisma.utilityCharge.deleteMany();
  await prisma.meterReading.deleteMany();
  await prisma.meter.deleteMany();
  await prisma.auditLog.deleteMany({ where: { module: "M11" } });
  await prisma.domainEvent.deleteMany({ where: { type: { startsWith: "utility." } } });

  // Own fixture lease (draft lease on a vacant room + verified member) —
  // immune to whatever earlier suites did to the seeded leases.
  const room = await prisma.room.findFirstOrThrow({
    where: { status: "vacant", leases: { none: { status: "active" } } },
    include: { floor: { include: { building: true } } }
  });
  propertyId = room.floor.building.propertyId;
  const party = await prisma.party.create({
    data: { type: "PERSON", name: "Utility Tester", email: "utility-tester@example.test", phone: "+855 10 000 001" }
  });
  const member = await prisma.memberProfile.create({
    data: { partyId: party.id, status: "verified", homePropertyId: propertyId, kycCompletedAt: new Date() }
  });
  const lease = await prisma.lease.create({
    data: {
      code: "LSE-TEST-U1",
      memberProfileId: member.id,
      roomId: room.id,
      propertyId,
      status: "draft",
      startDate: new Date("2026-09-01"),
      rentAmountMinor: 25000,
      billingCycleDay: 1,
      prorationBasis: "calendar",
      depositTotalMinor: 0,
      depositInstallments: 1,
      noticeDays: 30
    }
  });
  fixtureLease = lease.id;
  const activated = await activateLease(fixtureLease);
  if (!activated.ok) throw new Error(`fixture lease activation failed: ${JSON.stringify(activated)}`);

  const meter = await prisma.meter.create({ data: { code: "ELEC-TEST-1", type: "elec", roomId: room.id, unitLabel: "kWh" } });
  meter1 = meter.id;

  const vacantRoom = await prisma.room.findFirstOrThrow({
    where: { leases: { none: { status: "active" } } },
    include: { floor: { include: { building: true } } }
  });
  const vacantMeter = await prisma.meter.create({ data: { code: "ELEC-TEST-VAC", type: "elec", roomId: vacantRoom.id } });
  meterVacant = vacantMeter.id;
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe("§M11: readings → charges → next invoice cycle", () => {
  it("stores the baseline reading without a charge", async () => {
    const result = await recordReading(meter1, { valueMilli: 150_000, readAt: new Date("2026-08-25T10:00:00Z"), note: "install baseline" }, actor);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.consumptionMilli).toBe(0);
    expect(result.data.chargeId).toBeNull();
  });

  it("charges (reading − previous) × tariff on the second reading", async () => {
    const result = await recordReading(meter1, { valueMilli: 250_500, readAt: new Date("2026-09-02T10:00:00Z") }, actor);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.consumptionMilli).toBe(100_500); // 100.5 kWh
    expect(result.data.chargeMinor).toBe(3518); // 100.5 × 35 / 1000, half-up
    expect(result.data.anomaly).toBe(false);
    expect(result.data.warnings.join(" ")).not.toMatch(/tariff/i);

    const charge = await prisma.utilityCharge.findUniqueOrThrow({ where: { id: result.data.chargeId! } });
    expect(charge.status).toBe("pending");
    expect(charge.tariffName).toBe("Standard electricity");
  });

  it("rejects backwards readings and requires estimate history", async () => {
    const back = await recordReading(meter1, { valueMilli: 100_000, readAt: new Date("2026-09-03T10:00:00Z") }, actor);
    expect(back).toMatchObject({ ok: false, code: "INVALID_READING" });
    const est = await recordReading(meter1, { estimate: true, readAt: new Date("2026-09-04T10:00:00Z") }, actor);
    expect(est).toMatchObject({ ok: false, code: "NOT_ENOUGH_HISTORY" });
  });

  it("skips charges for vacant rooms (warning, reading still stored)", async () => {
    const baseline = await recordReading(meterVacant, { valueMilli: 42_000, readAt: new Date("2026-09-01T10:00:00Z") }, actor);
    expect(baseline.ok).toBe(true);
    const result = await recordReading(meterVacant, { valueMilli: 50_000, readAt: new Date("2026-09-02T10:00:00Z") }, actor);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.chargeId).toBeNull();
    expect(result.data.warnings.join(" ")).toMatch(/no active lease/i);
  });

  it("flags a spike (> 2× recent average) with a warning + anomaly charge", async () => {
    // Gaps so far: 100.5 kWh. A normal third reading (49.5) gives the spike
    // detector its second history point; the fourth (290.5) exceeds 2× the
    // 75 kWh average → flagged (§M11).
    const normal = await recordReading(meter1, { valueMilli: 300_000, readAt: new Date("2026-09-03T10:00:00Z") }, actor);
    expect(normal.ok).toBe(true);
    if (!normal.ok) return;
    expect(normal.data.anomaly).toBe(false);

    const result = await recordReading(meter1, { valueMilli: 590_500, readAt: new Date("2026-09-04T10:00:00Z") }, actor);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.anomaly).toBe(true);
    expect(result.data.warnings.join(" ")).toMatch(/spike/i);
    const event = await prisma.domainEvent.findFirst({ where: { type: "utility.anomaly" } });
    expect(event).not.toBeNull();
  });

  it("estimates the next reading as the average of the last 3 (flagged)", async () => {
    // Last 3 values: 590500, 300000, 250500 → avg 380333.33 → 380333 (below
    // the latest reading → negative consumption → no charge, stored flagged).
    const result = await recordReading(meter1, { estimate: true, readAt: new Date("2026-09-05T10:00:00Z") }, actor);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.estimated).toBe(true);
    expect(result.data.valueMilli).toBe(380_333);
    expect(result.data.chargeId).toBeNull();
    const reading = await prisma.meterReading.findUniqueOrThrow({ where: { id: result.data.readingId } });
    expect(reading.source).toBe("estimate");
  });

  it("imports CSV rows and skips invalid ones", async () => {
    const csv = [
      "2026-09-06,610.5", // 610500 → consumption 230167 → charge 8056
      "not-a-date,10",
      "2026-09-06,999", // same-day duplicate → rejected (order guard)
      "2026-09-07,620,after weekly check" // 620000 → consumption 9500 → charge 333
    ].join("\n");
    const result = await importReadingsCsv(meter1, csv, actor);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.imported).toBe(2);
    expect(result.data.skipped).toHaveLength(2);
  });

  it("folds pending charges into the next generated invoice as utility lines", async () => {
    const pendingBefore = await prisma.utilityCharge.count({ where: { leaseId: fixtureLease, status: "pending" } });
    expect(pendingBefore).toBeGreaterThan(0);

    const summary = await generateInvoices(actor);
    expect(summary.generated).toBeGreaterThan(0);

    const charges = await prisma.utilityCharge.findMany({
      where: { leaseId: fixtureLease },
      include: { meter: true }
    });
    const billed = charges.filter((c) => c.status === "billed");
    expect(billed.length).toBe(charges.length); // every charge rode the cycle
    for (const c of billed) {
      expect(c.invoiceId).not.toBeNull();
      expect(c.invoiceItemId).not.toBeNull();
      const item = await prisma.invoiceItem.findUniqueOrThrow({ where: { id: c.invoiceItemId! } });
      expect(item.kind).toBe("utility");
      expect(item.amountMinor).toBe(c.amountMinor);
      expect(item.name).toContain(c.meter.code);
    }
    // The invoice total includes the utility lines (invariant: Σ items − discount + tax = total).
    const firstBilled = billed.find((c) => c.invoiceId != null)!;
    const invoice = await prisma.invoice.findUniqueOrThrow({ where: { id: firstBilled.invoiceId! }, include: { items: true } });
    const sum = invoice.items.reduce((s, i) => s + i.amountMinor, 0);
    expect(invoice.totalMinor).toBe(sum - invoice.discountMinor + invoice.taxMinor);
  });

  it("voiding the invoice reverts the charges to pending (§M11 re-bill)", async () => {
    const charge = await prisma.utilityCharge.findFirstOrThrow({ where: { status: "billed" } });
    const voided = await voidInvoice(charge.invoiceId!, "duplicate cycle", actor);
    expect(voided).toMatchObject({ ok: true });
    const reverted = await prisma.utilityCharge.findUniqueOrThrow({ where: { id: charge.id } });
    expect(reverted.status).toBe("pending");
    expect(reverted.invoiceId).toBeNull();
    expect(reverted.invoiceItemId).toBeNull();
    expect(await revertChargesForInvoice(charge.invoiceId!)).toBe(0); // nothing left to revert
  });

  it("property-specific tariffs win over the org default", async () => {
    await upsertTariff(
      { utilityType: "elec", name: "Premium (property)", propertyId, unitRateMinor: 50, effectiveFrom: new Date("2026-01-01") },
      actor
    );
    const result = await recordReading(meter1, { valueMilli: 640_000, readAt: new Date("2026-09-09T10:00:00Z") }, actor);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.chargeMinor).toBe(1000); // 20 kWh × 50 / 1000
    const charge = await prisma.utilityCharge.findUniqueOrThrow({ where: { id: result.data.chargeId! } });
    expect(charge.tariffName).toBe("Premium (property)");
  });
});


void formatMilli;
