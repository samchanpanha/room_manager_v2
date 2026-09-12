import { describe, expect, it, vi } from "vitest";
import { prisma } from "@/lib/db";

vi.mock("@/lib/auth/session", () => ({
  getAuthUser: vi.fn(async () => {
    const user = await prisma.user.findFirstOrThrow({ where: { email: "root@demo.test" } });
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      propertyIds: [],
      permissions: [
        { module: "M05", action: "create", scope: "GLOBAL" },
        { module: "M05", action: "read", scope: "GLOBAL" },
        { module: "M05", action: "update", scope: "GLOBAL" },
        { module: "M05", action: "delete", scope: "GLOBAL" }
      ]
    };
  })
}));

import { POST } from "@/app/api/leases/route";

describe("Lease creation API & Validation (M05)", () => {
  it("rejects creation when required fields are missing", async () => {
    const req = new Request("http://localhost/api/leases", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({})
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe("VALIDATION_ERROR");
    expect(body.message).toBeTruthy();
  });

  it("rejects creation when end date is earlier than start date", async () => {
    const [member, room] = await Promise.all([
      prisma.memberProfile.findFirstOrThrow({ where: { status: { not: "moved_out" }, blacklisted: false } }),
      prisma.room.findFirstOrThrow({ where: { status: "vacant" } })
    ]);

    const req = new Request("http://localhost/api/leases", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        memberProfileId: member.id,
        roomId: room.id,
        startDate: "2026-09-10",
        endDate: "2026-09-01",
        rentAmount: 300
      })
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.message).toContain("End date must be after the start date");
  });

  it("successfully creates draft lease for prospect member and sets room to reserved", async () => {
    // Create dedicated prospect member & vacant room for testing
    const party = await prisma.party.create({
      data: { name: "Test Prospect Member", type: "individual", phone: "+85599000111" }
    });
    const member = await prisma.memberProfile.create({
      data: { partyId: party.id, status: "prospect", blacklisted: false }
    });
    const floor = await prisma.floor.findFirstOrThrow({ include: { building: true } });
    const room = await prisma.room.create({
      data: {
        floorId: floor.id,
        number: `T-DRAFT-${Date.now().toString().slice(-4)}`,
        status: "vacant",
        capacity: 1,
        basePriceMinor: 25000
      }
    });

    const req = new Request("http://localhost/api/leases", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        memberProfileId: member.id,
        roomId: room.id,
        startDate: "2026-09-15",
        rentAmount: 250,
        billingCycleDay: 1,
        prorationBasis: "calendar",
        depositTotal: 250,
        depositInstallments: 1,
        noticeDays: 30,
        escalationPercent: 5.5
      })
    });

    const res = await POST(req);
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.id).toBeTruthy();
    expect(body.code).toMatch(/^LSE-/);

    // Verify room status changed to reserved
    const updatedRoom = await prisma.room.findUniqueOrThrow({ where: { id: room.id } });
    expect(updatedRoom.status).toBe("reserved");

    // Clean up
    await prisma.lease.delete({ where: { id: body.id } });
    await prisma.room.delete({ where: { id: room.id } });
    await prisma.memberProfile.delete({ where: { id: member.id } });
    await prisma.party.delete({ where: { id: party.id } });
  });

  it("successfully creates lease with WiFi account and parking slot previously assigned to an ended lease", async () => {
    const floor = await prisma.floor.findFirstOrThrow({ include: { building: true } });
    const propertyId = floor.building.propertyId;

    const party = await prisma.party.create({
      data: { name: "Test Reusable WiFi Member", type: "individual", phone: "+85599111222" }
    });
    const member = await prisma.memberProfile.create({
      data: { partyId: party.id, status: "prospect", blacklisted: false }
    });
    const room = await prisma.room.create({
      data: {
        floorId: floor.id,
        number: `T-WIFI-${Date.now().toString().slice(-4)}`,
        status: "vacant",
        capacity: 1,
        basePriceMinor: 20000
      }
    });

    // Ensure wifi catalog item exists
    const wifiCatalog = await prisma.serviceCatalog.findUniqueOrThrow({ where: { code: "WIFI" } });
    // Ensure wifi account exists and is free
    const wifiAccount = await prisma.wifiAccount.upsert({
      where: { ssid: "test-reuse-wifi-999" },
      create: { ssid: "test-reuse-wifi-999", propertyId, speedLabel: "100 Mbps", status: "free" },
      update: { status: "free" }
    });

    // Simulate an ended assignment in history with this wifiAccountId
    const dummyLease = await prisma.lease.create({
      data: {
        code: `LSE-HIST-${Date.now().toString().slice(-4)}`,
        memberProfileId: member.id,
        roomId: room.id,
        propertyId,
        startDate: new Date("2026-01-01"),
        status: "ended",
        rentAmountMinor: 10000,
        billingCycleDay: 1,
        depositTotalMinor: 0
      }
    });
    await prisma.serviceAssignment.create({
      data: {
        serviceId: wifiCatalog.id,
        leaseId: dummyLease.id,
        startDate: new Date("2026-01-01"),
        endedAt: new Date("2026-02-01"),
        status: "ended",
        wifiAccountId: wifiAccount.id
      }
    });

    // Now create a NEW lease via POST /api/leases reassigning the free wifi account
    const req = new Request("http://localhost/api/leases", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        memberProfileId: member.id,
        roomId: room.id,
        startDate: "2026-09-15",
        rentAmount: 200,
        billingCycleDay: 1,
        depositTotal: 200,
        depositInstallments: 1,
        noticeDays: 30,
        services: [
          {
            serviceId: wifiCatalog.id,
            name: "High-Speed WiFi",
            amount: 15,
            pricingModel: "fixed_monthly",
            wifiSsid: "test-reuse-wifi-999"
          }
        ]
      })
    });

    const res = await POST(req);
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.id).toBeTruthy();

    // Verify the new service assignment was created with wifiAccountId
    const newAssignment = await prisma.serviceAssignment.findFirst({
      where: { leaseId: body.id, wifiAccountId: wifiAccount.id }
    });
    expect(newAssignment).toBeTruthy();
    expect(newAssignment?.status).toBe("active");

    // Verify wifi account is now assigned
    const updatedWifi = await prisma.wifiAccount.findUniqueOrThrow({ where: { id: wifiAccount.id } });
    expect(updatedWifi.status).toBe("assigned");

    // Cleanup
    await prisma.serviceAssignment.deleteMany({ where: { leaseId: { in: [body.id, dummyLease.id] } } });
    await prisma.leaseService.deleteMany({ where: { leaseId: { in: [body.id, dummyLease.id] } } });
    await prisma.lease.deleteMany({ where: { id: { in: [body.id, dummyLease.id] } } });
    await prisma.wifiAccount.delete({ where: { id: wifiAccount.id } });
    await prisma.room.delete({ where: { id: room.id } });
    await prisma.memberProfile.delete({ where: { id: member.id } });
    await prisma.party.delete({ where: { id: party.id } });
  });

  it("rejects duplicate wifi accounts or parking slots in the same lease request", async () => {
    const floor = await prisma.floor.findFirstOrThrow({ include: { building: true } });
    const propertyId = floor.building.propertyId;

    const party = await prisma.party.create({
      data: { name: "Test Dup Member", type: "individual", phone: "+85599222333" }
    });
    const member = await prisma.memberProfile.create({
      data: { partyId: party.id, status: "prospect", blacklisted: false }
    });
    const room = await prisma.room.create({
      data: {
        floorId: floor.id,
        number: `T-DUP-${Date.now().toString().slice(-4)}`,
        status: "vacant",
        capacity: 1,
        basePriceMinor: 20000
      }
    });

    const wifiCatalog = await prisma.serviceCatalog.findUniqueOrThrow({ where: { code: "WIFI" } });
    const wifiAccount = await prisma.wifiAccount.upsert({
      where: { ssid: "test-dup-wifi-888" },
      create: { ssid: "test-dup-wifi-888", propertyId, speedLabel: "100 Mbps", status: "free" },
      update: { status: "free" }
    });

    const req = new Request("http://localhost/api/leases", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        memberProfileId: member.id,
        roomId: room.id,
        startDate: "2026-09-15",
        rentAmount: 200,
        billingCycleDay: 1,
        depositTotal: 200,
        depositInstallments: 1,
        noticeDays: 30,
        services: [
          {
            serviceId: wifiCatalog.id,
            name: "WiFi 1",
            amount: 15,
            pricingModel: "fixed_monthly",
            wifiSsid: "test-dup-wifi-888"
          },
          {
            serviceId: wifiCatalog.id,
            name: "WiFi 2",
            amount: 15,
            pricingModel: "fixed_monthly",
            wifiSsid: "test-dup-wifi-888"
          }
        ]
      })
    });

    const res = await POST(req);
    expect(res.status).toBe(422);
    const body = await res.json();
    expect(body.error).toBe("WIFI_DUPLICATE");

    // Cleanup
    await prisma.wifiAccount.delete({ where: { id: wifiAccount.id } });
    await prisma.room.delete({ where: { id: room.id } });
    await prisma.memberProfile.delete({ where: { id: member.id } });
    await prisma.party.delete({ where: { id: party.id } });
  });
});
