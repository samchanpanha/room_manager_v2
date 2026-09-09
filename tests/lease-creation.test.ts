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
});
