import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/storage", () => ({
  storage: {
    put: vi.fn(async () => undefined),
    get: vi.fn(async () => Buffer.from("%PDF-fake")),
    delete: vi.fn(async () => undefined)
  }
}));

import { prisma } from "@/lib/db";
import { activateLease } from "@/lib/leases/service";
import { generateInvoices } from "@/lib/billing/service";
import { createPayment, confirmPayment } from "@/lib/payments/service";

describe("Monthly Room Rental with Optional Services (WiFi, Parking, Laundry, Utilities)", () => {
  let actor = { id: "", name: "" };
  let memberId = "";
  let roomId = "";
  let propertyId = "";
  let leaseId = "";
  let wifiCatalogId = "";
  let parkCatalogId = "";
  let laundryCatalogId = "";

  beforeAll(async () => {
    const root = await prisma.user.findFirstOrThrow({ where: { email: "root@demo.test" } });
    actor = { id: root.id, name: root.name };

    // Get or create active catalog services
    const wifi = await prisma.serviceCatalog.upsert({
      where: { code: "WIFI" },
      create: { code: "WIFI", name: "WiFi", pricingModel: "fixed_monthly", unitPriceMinor: 1500 },
      update: { name: "WiFi", pricingModel: "fixed_monthly", unitPriceMinor: 1500, isActive: true }
    });
    wifiCatalogId = wifi.id;

    const park = await prisma.serviceCatalog.upsert({
      where: { code: "PARK" },
      create: { code: "PARK", name: "Parking", pricingModel: "fixed_monthly", unitPriceMinor: 3000 },
      update: { name: "Parking", pricingModel: "fixed_monthly", unitPriceMinor: 3000, isActive: true }
    });
    parkCatalogId = park.id;

    const laundry = await prisma.serviceCatalog.upsert({
      where: { code: "LAUNDRY-M" },
      create: { code: "LAUNDRY-M", name: "Monthly Laundry Plan", pricingModel: "fixed_monthly", unitPriceMinor: 2500 },
      update: { name: "Monthly Laundry Plan", pricingModel: "fixed_monthly", unitPriceMinor: 2500, isActive: true }
    });
    laundryCatalogId = laundry.id;

    // Create isolated test member
    const party = await prisma.party.create({
      data: { name: "Monthly Svc Tester", email: `monthly-svc-${Date.now()}@example.test`, type: "individual" }
    });
    const member = await prisma.memberProfile.create({
      data: { partyId: party.id, status: "verified" }
    });
    memberId = member.id;

    const room = await prisma.room.findFirstOrThrow({
      where: { status: { in: ["vacant", "cleaning", "occupied"] } },
      include: { floor: { include: { building: true } } }
    });
    roomId = room.id;
    propertyId = room.floor.building.propertyId;

    // Clean up test assignments on slot and wifi account if any
    const prevAssignments = await prisma.serviceAssignment.findMany({
      where: {
        OR: [
          { parkingSlot: { code: "P-A01" } },
          { wifiAccount: { ssid: "demo-wifi-101" } }
        ]
      }
    });
    for (const pa of prevAssignments) {
      await prisma.serviceAssignment.delete({ where: { id: pa.id } });
    }

    // Ensure slot P-A01 exists and is free
    await prisma.parkingSlot.upsert({
      where: { code: "P-A01" },
      create: { code: "P-A01", propertyId, monthlyFeeMinor: 3000, status: "free" },
      update: { propertyId, status: "free" }
    });

    // Ensure wifi account exists and is free
    await prisma.wifiAccount.upsert({
      where: { ssid: "demo-wifi-101" },
      create: { ssid: "demo-wifi-101", propertyId, speedLabel: "100 Mbps", status: "free" },
      update: { propertyId, status: "free" }
    });
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("creates a monthly lease assigning WiFi, Parking slot, and Monthly Laundry plan", async () => {
    const startDate = new Date("2026-08-01T00:00:00Z");

    const lease = await prisma.$transaction(async (tx) => {
      const code = `LSE-TEST-OPT-${Date.now().toString().slice(-4)}`;
      const created = await tx.lease.create({
        data: {
          code,
          memberProfileId: memberId,
          roomId,
          propertyId,
          startDate,
          rentAmountMinor: 45000, // $450.00 / month
          billingCycleDay: 1,
          prorationBasis: "calendar",
          status: "draft",
          createdById: actor.id
        }
      });

      // 1. Assign WiFi
      const wifiSvc = await tx.leaseService.create({
        data: {
          leaseId: created.id,
          name: "WiFi",
          amountMinor: 1500, // $15.00
          pricingModel: "fixed_monthly",
          activeFrom: startDate
        }
      });
      await tx.serviceAssignment.create({
        data: {
          serviceId: wifiCatalogId,
          leaseId: created.id,
          snapshotId: wifiSvc.id,
          startDate,
          wifiAccountId: (await tx.wifiAccount.findUniqueOrThrow({ where: { ssid: "demo-wifi-101" } })).id
        }
      });
      await tx.wifiAccount.update({ where: { ssid: "demo-wifi-101" }, data: { status: "assigned" } });

      // 2. Assign Parking Slot P-A01
      const parkSvc = await tx.leaseService.create({
        data: {
          leaseId: created.id,
          name: "Parking (P-A01)",
          amountMinor: 3000, // $30.00
          pricingModel: "fixed_monthly",
          activeFrom: startDate
        }
      });
      await tx.serviceAssignment.create({
        data: {
          serviceId: parkCatalogId,
          leaseId: created.id,
          snapshotId: parkSvc.id,
          startDate,
          parkingSlotId: (await tx.parkingSlot.findUniqueOrThrow({ where: { code: "P-A01" } })).id
        }
      });
      await tx.parkingSlot.update({ where: { code: "P-A01" }, data: { status: "assigned" } });

      // 3. Assign Monthly Laundry Plan
      const laundrySvc = await tx.leaseService.create({
        data: {
          leaseId: created.id,
          name: "Monthly Laundry Plan",
          amountMinor: 2500, // $25.00
          pricingModel: "fixed_monthly",
          activeFrom: startDate
        }
      });
      await tx.serviceAssignment.create({
        data: {
          serviceId: laundryCatalogId,
          leaseId: created.id,
          snapshotId: laundrySvc.id,
          startDate
        }
      });

      return created;
    });

    leaseId = lease.id;
    expect(lease.id).toBeDefined();

    // Verify services are attached to the lease
    const services = await prisma.leaseService.findMany({ where: { leaseId } });
    expect(services.length).toBe(3);
    expect(services.map((s) => s.name).sort()).toEqual([
      "Monthly Laundry Plan",
      "Parking (P-A01)",
      "WiFi"
    ]);

    // Activate lease
    const activated = await activateLease(leaseId);
    expect(activated.ok).toBe(true);

    // Verify resources remain assigned
    expect((await prisma.parkingSlot.findUniqueOrThrow({ where: { code: "P-A01" } })).status).toBe("assigned");
    expect((await prisma.wifiAccount.findUniqueOrThrow({ where: { ssid: "demo-wifi-101" } })).status).toBe("assigned");
  });

  it("generates monthly invoices including Rent + all assigned optional services", async () => {
    // Run generation job
    const summary = await generateInvoices(actor);
    expect(summary.generated).toBeGreaterThan(0);

    // Fetch generated invoice for this lease
    const invoices = await prisma.invoice.findMany({
      where: { leaseId, isDeposit: false },
      include: { items: true },
      orderBy: { periodStart: "asc" }
    });

    expect(invoices.length).toBeGreaterThan(0);
    const invoice = invoices[0]!;

    // Check all expected lines are present on the monthly invoice:
    // 1. Rent: $450.00 (45000)
    // 2. WiFi: $15.00 (1500)
    // 3. Parking: $30.00 (3000)
    // 4. Monthly Laundry Plan: $25.00 (2500)
    // Total subtotal = 45000 + 1500 + 3000 + 2500 = 52000 ($520.00)
    const rentLine = invoice.items.find((i) => i.kind === "rent");
    expect(rentLine).toBeDefined();
    expect(rentLine?.amountMinor).toBe(45000);

    const wifiLine = invoice.items.find((i) => i.name.includes("WiFi"));
    expect(wifiLine).toBeDefined();
    expect(wifiLine?.kind).toBe("service");
    expect(wifiLine?.amountMinor).toBe(1500);

    const parkLine = invoice.items.find((i) => i.name.includes("Parking"));
    expect(parkLine).toBeDefined();
    expect(parkLine?.kind).toBe("service");
    expect(parkLine?.amountMinor).toBe(3000);

    const laundryLine = invoice.items.find((i) => i.name.includes("Laundry"));
    expect(laundryLine).toBeDefined();
    expect(laundryLine?.kind).toBe("service");
    expect(laundryLine?.amountMinor).toBe(2500);

    expect(invoice.subtotalMinor).toBe(52000);
    expect(invoice.totalMinor).toBe(52000);
    expect(invoice.amountDueMinor).toBe(52000);
  });

  it("allows member to pay monthly invoice in full, settling all rent and services", async () => {
    const invoice = await prisma.invoice.findFirstOrThrow({
      where: { leaseId, isDeposit: false, status: { in: ["issued", "partial_paid"] } }
    });

    const payment = await createPayment(actor, {
      memberProfileId: memberId,
      method: "bank_transfer",
      amountMinor: invoice.amountDueMinor,
      allocations: [{ invoiceId: invoice.id, amountMinor: invoice.amountDueMinor }]
    });
    expect(payment.ok).toBe(true);

    const confirmed = await confirmPayment((payment as { paymentId: string }).paymentId, actor);
    expect(confirmed.ok).toBe(true);

    const paidInvoice = await prisma.invoice.findUniqueOrThrow({ where: { id: invoice.id } });
    expect(paidInvoice.status).toBe("paid");
    expect(paidInvoice.amountDueMinor).toBe(0);
    expect(paidInvoice.amountPaidMinor).toBe(52000);
  });
});
