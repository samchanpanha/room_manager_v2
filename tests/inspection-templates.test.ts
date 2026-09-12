import { beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/storage", () => ({
  storage: {
    put: vi.fn(async () => undefined),
    get: vi.fn(async () => Buffer.from("%PDF-fake")),
    delete: vi.fn(async () => undefined)
  }
}));

import { prisma } from "@/lib/db";
import { completeInspection, createInspection } from "@/lib/operations/inspections-service";

describe("Inspection Templates & Item Capture Workflow", () => {
  let actor: { id: string; name: string };
  let testLease: { id: string; roomId: string; code: string };

  beforeAll(async () => {
    const user = await prisma.user.findFirst({ where: { status: "active" } });
    if (!user) throw new Error("No active user found in db");
    actor = { id: user.id, name: user.name };

    // Find or create test lease
    let lease = await prisma.lease.findFirst({
      where: { status: "active" },
      include: { room: true }
    });

    if (!lease) {
      const prop = await prisma.property.findFirstOrThrow();
      const building = await prisma.building.findFirstOrThrow({ where: { propertyId: prop.id } });
      const floor = await prisma.floor.findFirstOrThrow({ where: { buildingId: building.id } });
      const party = await prisma.party.create({
        data: { name: `Insp Test Tenant ${Date.now()}`, type: "PERSON" }
      });
      const member = await prisma.memberProfile.create({
        data: { partyId: party.id, status: "active", homePropertyId: prop.id }
      });
      const room = await prisma.room.create({
        data: { floorId: floor.id, number: `INSP-${Date.now().toString().slice(-4)}`, status: "occupied", basePriceMinor: 50000 }
      });
      lease = await prisma.lease.create({
        data: {
          code: `LSE-INSP-${Date.now().toString().slice(-4)}`,
          memberProfileId: member.id,
          roomId: room.id,
          propertyId: prop.id,
          status: "active",
          startDate: new Date("2026-08-01"),
          rentAmountMinor: 50000,
          billingCycleDay: 1
        },
        include: { room: true }
      });
    }

    testLease = { id: lease.id, roomId: lease.roomId, code: lease.code };
  });

  it("creates and retrieves an inspection checklist template in database", async () => {
    const templateName = `Custom Deluxe Checklist ${Date.now()}`;
    const template = await prisma.inspectionTemplate.create({
      data: {
        name: templateName,
        roomType: "DELUXE",
        sections: [
          {
            title: "Door & Locks",
            items: ["Door locks smoothly", "Deadbolt operational", "Access card functional"]
          },
          {
            title: "Air Conditioning",
            items: ["A/C cooling test", "Drain pipe unobstructed", "Remote control present"]
          }
        ],
        isActive: true
      }
    });

    expect(template.id).toBeDefined();
    expect(template.name).toBe(templateName);
    expect(template.roomType).toBe("DELUXE");

    const found = await prisma.inspectionTemplate.findUnique({
      where: { id: template.id }
    });
    expect(found).not.toBeNull();
    expect(found?.name).toBe(templateName);
  });

  it("captures checklist items (pass / fail / NA) and generates findings for failed items", async () => {
    // 1. Create a draft inspection
    const created = await createInspection(
      {
        type: "move_out",
        leaseId: testLease.id,
        roomId: testLease.roomId,
        note: "Move-out check with findings"
      },
      actor
    );

    expect(created.ok).toBe(true);
    if (!created.ok) return;

    const inspectionId = created.data.id;

    // 2. Complete inspection with items (Pass, Fail with severity and note, NA)
    const items = [
      {
        section: "Door & locks",
        item: "Door closes and locks",
        result: "pass"
      },
      {
        section: "Water & fixtures",
        item: "Sink drain and piping",
        result: "fail",
        severity: "major",
        note: "Sink drain pipe cracked under basin, leaking water onto shelf"
      },
      {
        section: "Appliances",
        item: "Mini-fridge cooling",
        result: "fail",
        severity: "minor",
        note: "Freezer door hinge loose"
      },
      {
        section: "Balcony",
        item: "Balcony door lock",
        result: "na"
      }
    ];

    const completed = await completeInspection(
      inspectionId,
      {
        items,
        summaryNote: "Move-out inspection completed: 2 items passed/NA, 2 items failed"
      },
      actor
    );

    expect(completed.ok).toBe(true);
    if (!completed.ok) return;

    // 1 pass, 2 fail, 1 na => score = 1 / (1 + 2) = 33% (out of non-NA)
    expect(completed.data.overallScore).toBe(33);
    expect(completed.data.findings).toBe(2);

    // Verify findings created in database
    const findings = await prisma.inspectionFinding.findMany({
      where: { inspectionId }
    });

    expect(findings.length).toBe(2);

    const sinkFinding = findings.find((f) => f.itemLabel === "Sink drain and piping");
    expect(sinkFinding).toBeDefined();
    expect(sinkFinding?.severity).toBe("major");
    expect(sinkFinding?.note).toContain("Sink drain pipe cracked");

    const fridgeFinding = findings.find((f) => f.itemLabel === "Mini-fridge cooling");
    expect(fridgeFinding).toBeDefined();
    expect(fridgeFinding?.severity).toBe("minor");
    expect(fridgeFinding?.note).toContain("Freezer door hinge loose");
  });
});
