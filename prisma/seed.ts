/// Seed: permissions (module × action), default roles from the RBDC matrix,
/// org settings, demo users and a demo property tree (INTENT.md §5, §6, §10).
/// Idempotent — safe to re-run.
import { createHash, randomBytes } from "node:crypto";
import { PrismaClient } from "@prisma/client";
import { hashPassword } from "../src/lib/auth/password";
import {
  ACTIONS,
  DEFAULT_ROLES,
  MATRIX,
  MODULES,
  expandRole,
  permissionId,
  type RoleKey
} from "../src/lib/rbac/catalog";

const db = new PrismaClient();

const DEMO_PASSWORD = "Demo1234!";

async function seedSettings(): Promise<void> {
  // §M28 unified keys (getSettings() is the single consumer surface — the
  // former org.profile / billing.lateFee / billing.dunning keys are retired).
  const settings: Array<[string, unknown]> = [
    ["m28.org", { name: "Demo Living Co.", legalName: "Demo Living Co., Ltd", address: "Phnom Penh, Cambodia", phone: "+855 23 000 000", email: "hello@demoliving.test", website: "https://demoliving.test", taxId: "KH-000-000-000", logo: "", invoiceFooterNote: "Thank you for your tenancy.", invoiceTemplate: "classic" }],
    ["m28.printer", { paperWidthMm: 80, autoPrintReceipt: false, receiptCopies: 1, printBarcodeByDefault: false }],
    ["m28.telegram", { botName: "", welcomeMessage: "", allowMemberLinking: true }],
    ["m28.locale", { currency: "USD", timezone: "Asia/Phnom_Penh", locale: "en" }],
    ["m28.billing", { invoicePrefix: "", graceDays: 3, dunningDays: [3, 7, 14] }],
    ["m28.lateFee", { mode: "flat", flatMinor: 500, monthlyPctBps: 0, maxMinor: 5000 }],
    ["m28.templates", {}],
    ["billing.generation", { leadDays: 3 }],
    ["moves.moveFeeMinor", 2000],
    ["features.modules", {}],
    ["m28.table", { pageSize: 25 }],
    ["m28.alerts", { aheadDays: 3, overdueDays: 1 }]
  ];
  for (const [key, value] of settings) {
    await db.setting.upsert({
      where: { key },
      create: { key, value: JSON.stringify(value), updatedBy: "seed" },
      update: {}
    });
  }
  await db.numberSequence.upsert({ where: { key: "MISC" }, create: { key: "MISC", value: 0 }, update: {} });
}

async function seedPermissions(): Promise<void> {
  for (const m of MODULES) {
    for (const action of ACTIONS) {
      const id = permissionId(m.key, action);
      await db.permission.upsert({
        where: { id },
        create: { id, module: m.key, action },
        update: {}
      });
    }
  }
}

async function seedRoles(): Promise<void> {
  for (const def of DEFAULT_ROLES) {
    const role = await db.role.upsert({
      where: { key: def.key },
      create: { key: def.key, name: def.name, description: def.description, isSystem: true, isProtected: def.isProtected },
      update: { name: def.name, description: def.description }
    });
    const perms = expandRole(def.key as RoleKey);
    for (const p of perms) {
      const pid = permissionId(p.module, p.action);
      await db.rolePermission.upsert({
        where: { roleId_permissionId_scope: { roleId: role.id, permissionId: pid, scope: p.scope } },
        create: { roleId: role.id, permissionId: pid, scope: p.scope },
        update: {}
      });
    }
  }
  // Remove stale role-permission rows for default roles that are no longer in the matrix.
  for (const def of DEFAULT_ROLES) {
    const role = await db.role.findUnique({ where: { key: def.key }, include: { permissions: true } });
    if (!role) continue;
    const allowed = new Set(expandRole(def.key as RoleKey).map((p) => `${permissionId(p.module, p.action)}:${p.scope}`));
    for (const rp of role.permissions) {
      if (!allowed.has(`${rp.permissionId}:${rp.scope}`)) {
        await db.rolePermission.delete({
          where: { roleId_permissionId_scope: { roleId: role.id, permissionId: rp.permissionId, scope: rp.scope } }
        });
      }
    }
  }
}

interface DemoUser {
  email: string;
  name: string;
  role: RoleKey;
  propertyCodes?: string[];
  /// Demo Admin+ users pre-marked as 2FA-enabled (without a secret) so they
  /// skip mandatory TOTP enforcement on the demo seed — password-only login,
  /// full menu access. §M27 §15.demo.
  totpEnabled?: boolean;
}

const DEMO_USERS: DemoUser[] = [
  { email: "root@demo.test", name: "Sofia Reyes", role: "SUPER_ADMIN", totpEnabled: true },
  { email: "admin@demo.test", name: "Daniel Chen", role: "ADMIN", totpEnabled: true },
  { email: "pm@demo.test", name: "Malis Horn", role: "PROPERTY_MANAGER", propertyCodes: ["BLR"] },
  { email: "accountant@demo.test", name: "Ivy Sok", role: "ACCOUNTANT" },
  { email: "staff@demo.test", name: "Ratana Kim", role: "STAFF", propertyCodes: ["BLR"] },
  { email: "owner@demo.test", name: "Lim Hout", role: "OWNER" },
  { email: "owner2@demo.test", name: "Chan Chaya", role: "OWNER" }
];

async function seedUsers(): Promise<void> {
  for (const u of DEMO_USERS) {
    const party = await db.party.upsert({
      where: { id: `party_${u.email}` },
      create: { id: `party_${u.email}`, type: "PERSON", name: u.name, email: u.email },
      update: {}
    });
    const user = await db.user.upsert({
      where: { email: u.email },
      create: {
        email: u.email,
        name: u.name,
        passwordHash: hashPassword(DEMO_PASSWORD),
        partyId: party.id,
        totpEnabled: u.totpEnabled ?? false
      },
      update: {
        // Demo Admin+ users are marked 2FA-enabled (no secret) to bypass the
        // mandatory-enrollment force (password-only login + full menu).
        // Only update when the field is explicitly set to avoid clobbering a
        // real secret enrollment on non-demo re-runs.
        ...(u.totpEnabled !== undefined ? { totpEnabled: u.totpEnabled } : {})
      }
    });
    const role = await db.role.findUnique({ where: { key: u.role } });
    if (!role) throw new Error(`Role ${u.role} missing`);
    await db.userRole.upsert({
      where: { userId_roleId: { userId: user.id, roleId: role.id } },
      create: { userId: user.id, roleId: role.id },
      update: {}
    });
    for (const code of u.propertyCodes ?? []) {
      const property = await db.property.findUnique({ where: { code } });
      if (property) {
        await db.userPropertyAssignment.upsert({
          where: { userId_propertyId: { userId: user.id, propertyId: property.id } },
          create: { userId: user.id, propertyId: property.id },
          update: {}
        });
      }
    }
  }
}

interface RoomSpec {
  prefix: string;
  start: number;
  count: number;
  beds: number;
  price: number; // minor units
  type?: string;
}

async function seedProperties(): Promise<void> {
  // Property 1 — main demo asset (PM/Staff are assigned here only, for scope testing).
  const blr = await db.property.upsert({
    where: { code: "BLR" },
    create: { code: "BLR", name: "Bassac Lane Residence", address: "Street 13, Bassac Lane, Phnom Penh" },
    update: {}
  });
  const bldgA = await db.building.upsert({
    where: { propertyId_name: { propertyId: blr.id, name: "Building A" } },
    create: { propertyId: blr.id, name: "Building A", address: "Street 13, Bassac Lane" },
    update: {}
  });

  const floorPlan: Array<{ name: string; level: number; spec: RoomSpec }> = [
    { name: "Ground", level: 0, spec: { prefix: "G0", start: 1, count: 3, beds: 1, price: 18000 } },
    { name: "Floor 1", level: 1, spec: { prefix: "A1", start: 1, count: 6, beds: 1, price: 25000, type: "DELUXE" } },
    { name: "Floor 2", level: 2, spec: { prefix: "A2", start: 1, count: 6, beds: 1, price: 25000, type: "DELUXE" } },
    { name: "Floor 3", level: 3, spec: { prefix: "A3", start: 1, count: 4, beds: 2, price: 32000, type: "STUDIO" } }
  ];

  const createdRoomIds: string[] = [];
  for (const f of floorPlan) {
    const floor = await db.floor.upsert({
      where: { buildingId_name: { buildingId: bldgA.id, name: f.name } },
      create: { buildingId: bldgA.id, name: f.name, level: f.level },
      update: {}
    });
    for (let i = 0; i < f.spec.count; i++) {
      const number = `${f.spec.prefix}-${String(f.spec.start + i).padStart(2, "0")}`;
      const room = await db.room.upsert({
        where: { floorId_number: { floorId: floor.id, number } },
        create: {
          floorId: floor.id,
          number,
          type: f.spec.type ?? "STANDARD",
          basePriceMinor: f.spec.price,
          capacity: f.spec.beds
        },
        update: {}
      });
      createdRoomIds.push(room.id);
      for (let b = 1; b <= f.spec.beds; b++) {
        const label = f.spec.beds > 1 ? `Bed ${b}` : "Single";
        await db.bed.upsert({
          where: { roomId_label: { roomId: room.id, label } },
          create: { roomId: room.id, label },
          update: {}
        });
      }
    }
  }

  // A little operational variety (statuses reachable in the machine from vacant).
  const pick = (n: number) => createdRoomIds[n];
  await db.room.update({ where: { id: pick(4) }, data: { status: "reserved" } });
  await db.room.update({ where: { id: pick(5) }, data: { status: "cleaning" } });
  await db.room.update({ where: { id: pick(10) }, data: { status: "maintenance", notes: "AC unit replacement" } });

  // Property 2 — small villa, NOT assigned to PM/Staff (negative-scope demos).
  const rv = await db.property.upsert({
    where: { code: "RV" },
    create: { code: "RV", name: "Riverside Villa", address: "Preah Sisowath Quay, Phnom Penh" },
    update: {}
  });
  const vb = await db.building.upsert({
    where: { propertyId_name: { propertyId: rv.id, name: "Villa Main" } },
    create: { propertyId: rv.id, name: "Villa Main" },
    update: {}
  });
  const vf = await db.floor.upsert({
    where: { buildingId_name: { buildingId: vb.id, name: "Ground" } },
    create: { buildingId: vb.id, name: "Ground", level: 0 },
    update: {}
  });
  for (let i = 1; i <= 2; i++) {
    const number = `V-0${i}`;
    await db.room.upsert({
      where: { floorId_number: { floorId: vf.id, number } },
      create: { floorId: vf.id, number, basePriceMinor: 45000, capacity: 2, type: "SUITE" },
      update: {}
    });
  }
}

async function seedDocTypes(): Promise<void> {
  const docTypes: Array<{ id: string; name: string; kycRequired: boolean; requiresExpiry: boolean; sortOrder: number }> = [
    { id: "passport", name: "Passport", kycRequired: true, requiresExpiry: true, sortOrder: 1 },
    { id: "national_id", name: "National ID", kycRequired: true, requiresExpiry: true, sortOrder: 2 },
    { id: "visa", name: "Visa / permit", kycRequired: false, requiresExpiry: true, sortOrder: 3 },
    { id: "employment_contract", name: "Employment contract", kycRequired: true, requiresExpiry: false, sortOrder: 4 },
    { id: "student_id", name: "Student ID", kycRequired: false, requiresExpiry: true, sortOrder: 5 },
    { id: "other", name: "Other", kycRequired: false, requiresExpiry: false, sortOrder: 99 },
    // Non-KYC types used by later modules for auto-filed generated PDFs:
    { id: "lease_contract", name: "Lease contract", kycRequired: false, requiresExpiry: false, sortOrder: 20 },
    { id: "invoice", name: "Invoice PDF", kycRequired: false, requiresExpiry: false, sortOrder: 21 },
    { id: "receipt", name: "Receipt", kycRequired: false, requiresExpiry: false, sortOrder: 22 },
    { id: "inspection_report", name: "Inspection report", kycRequired: false, requiresExpiry: false, sortOrder: 23 },
    { id: "statement", name: "Owner statement", kycRequired: false, requiresExpiry: false, sortOrder: 24 },
    { id: "stock_photo", name: "Stock item photo", kycRequired: false, requiresExpiry: false, sortOrder: 30 },
    { id: "product_photo", name: "POS product photo", kycRequired: false, requiresExpiry: false, sortOrder: 31 },
    { id: "service_photo", name: "Service catalog photo", kycRequired: false, requiresExpiry: false, sortOrder: 32 }
  ];
  for (const dt of docTypes) {
    await db.docType.upsert({ where: { id: dt.id }, create: dt, update: dt });
  }
}

/// Placeholder object for seeded demo documents (tiny stub PDF).
async function putDemoDoc(fileName: string): Promise<{ storageKey: string; size: number }> {
  const { storage } = await import("../src/lib/storage");
  const bytes = Buffer.from(`%PDF-1.4\n% RentManager demo document: ${fileName}\n%%EOF\n`, "utf8");
  const key = randomBytes(16).toString("hex");
  await storage.put(key, bytes);
  return { storageKey: key, size: bytes.length };
}

interface DemoMember {
  email: string;
  name: string;
  phone: string;
  nationality: string;
  idNumber: string;
  occupation: string;
  propertyCode: string;
  status: "prospect" | "verified";
  blacklisted?: { reason: string };
  documents: Array<{ docTypeId: string; expiresInDays?: number }>;
  contacts: Array<{ name: string; relationship: string; phone: string }>;
}

const DEMO_MEMBERS: DemoMember[] = [
  {
    email: "chan.ling@example.test",
    name: "Chan Ling",
    phone: "+855 12 345 678",
    nationality: "Khmer",
    idNumber: "KH-998877",
    occupation: "Software engineer",
    propertyCode: "BLR",
    status: "verified",
    documents: [
      { docTypeId: "passport", expiresInDays: 20 }, // near-expiry → 30d reminder badge
      { docTypeId: "employment_contract" }
    ],
    contacts: [{ name: "Chan Sokha", relationship: "Sister", phone: "+855 12 999 888" }]
  },
  {
    email: "sophea.nuon@example.test",
    name: "Sophea Nuon",
    phone: "+855 92 111 222",
    nationality: "Khmer",
    idNumber: "KH-554433",
    occupation: "Teacher",
    propertyCode: "BLR",
    status: "prospect", // KYC incomplete (missing employment contract)
    documents: [{ docTypeId: "national_id", expiresInDays: 400 }],
    contacts: [{ name: "Nuon Vira", relationship: "Brother", phone: "+855 92 333 444" }]
  },
  {
    email: "david.cruz@example.test",
    name: "David Cruz",
    phone: "+855 70 555 666",
    nationality: "Filipino",
    idNumber: "PH-112233",
    occupation: "Consultant",
    propertyCode: "BLR",
    status: "verified",
    blacklisted: { reason: "Unpaid dues from prior stay; damaged furniture — banned by management" },
    documents: [
      { docTypeId: "passport", expiresInDays: 700 },
      { docTypeId: "employment_contract" }
    ],
    contacts: [{ name: "Ana Cruz", relationship: "Spouse", phone: "+855 70 777 888" }]
  },
  {
    email: "maria.lopez@example.test",
    name: "Maria Lopez",
    phone: "+855 10 222 333",
    nationality: "Spanish",
    idNumber: "ES-445566",
    occupation: "Designer",
    propertyCode: "RV", // different property → cross-property access denial demo
    status: "verified",
    documents: [
      { docTypeId: "passport", expiresInDays: 900 },
      { docTypeId: "employment_contract" }
    ],
    contacts: [{ name: "Pablo Lopez", relationship: "Brother", phone: "+855 10 444 555" }]
  }
];

async function seedMembers(): Promise<void> {
  for (const m of DEMO_MEMBERS) {
    const party = await db.party.upsert({
      where: { id: `party_${m.email}` },
      create: { id: `party_${m.email}`, type: "PERSON", name: m.name, email: m.email, phone: m.phone },
      update: {}
    });
    const property = await db.property.findUnique({ where: { code: m.propertyCode } });
    const kycComplete = m.status === "verified";
    const member = await db.memberProfile.upsert({
      where: { partyId: party.id },
      create: {
        partyId: party.id,
        status: m.status,
        blacklisted: m.blacklisted ? true : false,
        blacklistReason: m.blacklisted?.reason ?? null,
        homePropertyId: property?.id ?? null,
        nationality: m.nationality,
        idNumber: m.idNumber,
        occupation: m.occupation,
        kycCompletedAt: kycComplete ? new Date() : null
      },
      update: {}
    });
    for (const c of m.contacts) {
      const existing = await db.emergencyContact.findFirst({ where: { memberProfileId: member.id, name: c.name } });
      if (!existing) {
        await db.emergencyContact.create({ data: { memberProfileId: member.id, ...c } });
      }
    }
    for (const d of m.documents) {
      const existing = await db.documentRegistry.findFirst({
        where: { entity: "MEMBER", entityId: member.id, docTypeId: d.docTypeId }
      });
      if (existing) continue;
      const meta = await putDemoDoc(`${d.docTypeId} — ${m.name}`);
      const type = await db.docType.findUnique({ where: { id: d.docTypeId } });
      await db.documentRegistry.create({
        data: {
          docTypeId: d.docTypeId,
          entity: "MEMBER",
          entityId: member.id,
          fileName: `${d.docTypeId.replace("_", "-")}-${m.name.toLowerCase().replace(/\s+/g, "-")}.pdf`,
          mimeType: "application/pdf",
          sizeBytes: meta.size,
          storageKey: meta.storageKey,
          expiryDate:
            d.expiresInDays !== undefined && type?.requiresExpiry
              ? new Date(Date.now() + d.expiresInDays * 24 * 60 * 60 * 1000)
              : null,
          propertyId: property?.id ?? null,
          notes: "Seeded demo document"
        }
      });
      if (d.expiresInDays !== undefined && d.expiresInDays <= 45) {
        await db.domainEvent.create({
          data: {
            type: "document.expiry_upcoming",
            propertyId: property?.id ?? null,
            payload: JSON.stringify({
              member: m.name,
              docType: d.docTypeId,
              expiresWithinDays: d.expiresInDays,
              reminder: d.expiresInDays <= 7 ? "7-day" : "30-day"
            })
          }
        });
      }
    }
  }
}


interface DemoOwner {
  email: string;
  companyName?: string;
  payout: { kind: string; bankName?: string; accountName: string; accountNumber: string };
  buildings: Array<[propertyCode: string, buildingName: string]>;
}

const DEMO_OWNERS: DemoOwner[] = [
  {
    email: "owner@demo.test",
    companyName: "Hout Properties Co., Ltd",
    payout: { kind: "BANK", bankName: "ABA Bank", accountName: "Lim Hout", accountNumber: "000088-777" },
    buildings: [["BLR", "Building A"]]
  },
  {
    email: "owner2@demo.test",
    payout: { kind: "MOBILE_MONEY", bankName: "Wing", accountName: "Chan Chaya", accountNumber: "012 345 6789" },
    buildings: [["RV", "Villa Main"]]
  }
];

async function seedOwners(): Promise<void> {
  for (const o of DEMO_OWNERS) {
    const party = await db.party.upsert({
      where: { id: `party_${o.email}` },
      create: { id: `party_${o.email}`, type: o.companyName ? "COMPANY" : "PERSON", name: o.companyName ?? o.email },
      update: {}
    });
    const owner = await db.ownerProfile.upsert({
      where: { partyId: party.id },
      create: { partyId: party.id, companyName: o.companyName, notes: "Seeded demo owner" },
      update: {}
    });
    const existingMethod = await db.ownerPayoutMethod.findFirst({
      where: { ownerProfileId: owner.id, accountNumber: o.payout.accountNumber }
    });
    if (!existingMethod) {
      await db.ownerPayoutMethod.create({ data: { ownerProfileId: owner.id, ...o.payout, isPrimary: true } });
    }
    for (const [propertyCode, buildingName] of o.buildings) {
      const building = await db.building.findFirst({ where: { property: { code: propertyCode }, name: buildingName } });
      if (building) {
        await db.building.update({ where: { id: building.id }, data: { ownerId: owner.id } });
      }
    }
  }
}

async function seedLeases(): Promise<void> {
  // Owner contracts
  const lim = await db.ownerProfile.findFirst({ where: { party: { email: "owner@demo.test" } } });
  const chaya = await db.ownerProfile.findFirst({ where: { party: { email: "owner2@demo.test" } } });
  const bldgA = await db.building.findFirst({ where: { name: "Building A" } });
  const villa = await db.building.findFirst({ where: { name: "Villa Main" } });

  if (lim && bldgA) {
    await db.ownerContract.upsert({
      where: { code: "OWC-0001" },
      create: {
        code: "OWC-0001",
        ownerProfileId: lim.id,
        buildingId: bldgA.id,
        model: "REVENUE_SHARE",
        sharePercent: 60,
        managementFeePercent: 10,
        startDate: new Date(Date.UTC(2026, 0, 1)),
        payoutCycleDay: 5,
        status: "active",
        notes: "Golden-path demo: 60% revenue share, 10% management fee"
      },
      update: {}
    });
    await db.numberSequence.upsert({ where: { key: "OWC" }, create: { key: "OWC", value: 1 }, update: { value: 1 } });
  }
  if (chaya && villa) {
    await db.ownerContract.upsert({
      where: { code: "OWC-0002" },
      create: {
        code: "OWC-0002",
        ownerProfileId: chaya.id,
        buildingId: villa.id,
        model: "FIXED_RENT",
        fixedRentMinor: 65000,
        managementFeePercent: 0,
        startDate: new Date(Date.UTC(2026, 0, 1)),
        payoutCycleDay: 5,
        status: "active",
        notes: "Fixed master rent demo"
      },
      update: {}
    });
    await db.numberSequence.upsert({ where: { key: "OWC" }, create: { key: "OWC", value: 2 }, update: { value: 2 } });
  }

  // Member leases
  const ling = await db.memberProfile.findFirst({ where: { party: { email: "chan.ling@example.test" } } });
  const sophea = await db.memberProfile.findFirst({ where: { party: { email: "sophea.nuon@example.test" } } });
  const floor1 = await db.floor.findFirst({ where: { name: "Floor 1", building: { name: "Building A" } } });
  if (!ling || !sophea || !floor1 || !bldgA) throw new Error("Seed dependency missing for leases");
  const property = await db.property.findUniqueOrThrow({ where: { code: "BLR" } });

  const roomA101 = await db.room.findUniqueOrThrow({ where: { floorId_number: { floorId: floor1.id, number: "A1-01" } } });
  const roomA102 = await db.room.findUniqueOrThrow({ where: { floorId_number: { floorId: floor1.id, number: "A1-02" } } });

  const lingLease = await db.lease.upsert({
    where: { code: "LSE-0001" },
    create: {
      code: "LSE-0001",
      memberProfileId: ling.id,
      roomId: roomA101.id,
      propertyId: property.id,
      status: "active",
      startDate: new Date(Date.UTC(2026, 7, 15)), // mid-month move-in (golden path)
      rentAmountMinor: 25000,
      billingCycleDay: 1,
      prorationBasis: "calendar",
      depositTotalMinor: 50000,
      depositInstallments: 2,
      noticeDays: 30,
      nextBillingDate: new Date(Date.UTC(2026, 8, 1)),
      services: { create: [{ name: "WiFi", amountMinor: 1500, pricingModel: "fixed_monthly" }] }
    },
    update: {}
  });
  if (lingLease) {
    await db.room.update({ where: { id: roomA101.id }, data: { status: "occupied" } });
    await db.memberProfile.update({ where: { id: ling.id }, data: { status: "active" } });
  }

  await db.lease.upsert({
    where: { code: "LSE-0002" },
    create: {
      code: "LSE-0002",
      memberProfileId: sophea.id,
      roomId: roomA102.id,
      propertyId: property.id,
      status: "draft",
      startDate: new Date(Date.UTC(2026, 9, 1)),
      rentAmountMinor: 25000,
      billingCycleDay: 1,
      prorationBasis: "calendar",
      depositTotalMinor: 50000,
      depositInstallments: 1,
      noticeDays: 30
    },
    update: {}
  });
  await db.numberSequence.upsert({ where: { key: "LEASE" }, create: { key: "LEASE", value: 2 }, update: { value: 2 } });
  // A1-02 stays reserved (draft lease holds the pipeline slot).
}

async function seedLedgerAccounts(): Promise<void> {
  // Fixed system chart (INTENT.md M08 + §15 v1.2). 2300 Tax Payable extends
  // the named scheme; 3900 Owner Distributions hosts M24 payout accruals.
  const accounts: Array<[string, string, string]> = [
    ["1100", "Cash", "ASSET"],
    ["1200", "Bank", "ASSET"],
    ["1300", "Rent Receivable", "ASSET"],
    ["2100", "Deposit Liability", "LIABILITY"],
    ["2200", "Owner Payable", "LIABILITY"],
    ["2300", "Tax Payable", "LIABILITY"],
    ["3900", "Owner Distributions", "EQUITY"], // §15 v1.2 (M24 accruals)
    ["4000", "Rent Revenue", "INCOME"],
    ["4100", "Service Revenue", "INCOME"],
    ["4200", "Utility Revenue", "INCOME"],
    ["4300", "Late Fee Revenue", "INCOME"],
    ["4900", "Other Revenue", "INCOME"],
    ["5000", "Operating Expenses", "EXPENSE"],
    ["5100", "Bank Fees", "EXPENSE"]
  ];
  for (const [code, name, type] of accounts) {
    await db.ledgerAccount.upsert({ where: { code }, create: { code, name, type }, update: {} });
  }
}

async function seedBilling(): Promise<void> {
  const plans: Array<{ name: string; amountMinor: number; cycleDay: number; prorationBasis: string }> = [
    { name: "Standard Room", amountMinor: 18000, cycleDay: 1, prorationBasis: "calendar" },
    { name: "Deluxe Room", amountMinor: 25000, cycleDay: 1, prorationBasis: "calendar" },
    { name: "Studio", amountMinor: 32000, cycleDay: 1, prorationBasis: "calendar" },
    { name: "Suite", amountMinor: 45000, cycleDay: 1, prorationBasis: "calendar" }
  ];
  for (const plan of plans) {
    await db.rentPlan.upsert({ where: { name: plan.name }, create: plan, update: {} });
  }

  const lateFee = await db.lateFeeRule.findFirst({ where: { isActive: true } });
  if (!lateFee) {
    await db.lateFeeRule.create({
      data: { name: "Standard late fee", type: "FIXED", amountMinor: 500, capMinor: 5000, graceDays: 3 }
    });
  }
  const tax = await db.taxRule.findFirst({ where: { isActive: true, isDefault: true } });
  if (!tax) {
    await db.taxRule.create({ data: { name: "No tax (default)", percentBps: 0, isDefault: true } });
  }

  // Link the demo active lease to the matching plan (catalog reference only).
  const lse1 = await db.lease.findUnique({ where: { code: "LSE-0001" } });
  const deluxe = await db.rentPlan.findUnique({ where: { name: "Deluxe Room" } });
  if (lse1 && deluxe && !lse1.rentPlanId) {
    await db.lease.update({ where: { id: lse1.id }, data: { rentPlanId: deluxe.id } });
  }
}


async function seedUtilitiesServices(): Promise<void> {
  // M11/M12 demo catalog: tariffs, meters, services, parking slots, WiFi.
  if ((await db.serviceCatalog.count()) > 0) return; // idempotent re-runs
  const property = await db.property.findFirstOrThrow();
  await db.tariff.createMany({
    data: [
      { utilityType: "elec", name: "Standard electricity", propertyId: null, unitRateMinor: 35, effectiveFrom: new Date("2026-01-01") },
      { utilityType: "water", name: "Standard water", propertyId: null, unitRateMinor: 25, effectiveFrom: new Date("2026-01-01") }
    ]
  });
  const rooms = await db.room.findMany({ take: 2, orderBy: { number: "asc" } });
  for (const [i, room] of rooms.entries()) {
    await db.meter.create({ data: { code: `ELEC-${room.number}`, type: "elec", roomId: room.id, unitLabel: "kWh" } });
    await db.meter.create({ data: { code: `WATER-${room.number}`, type: "water", roomId: room.id, unitLabel: "m³" } });
    void i;
  }
  await db.serviceCatalog.createMany({
    data: [
      { code: "WIFI", name: "WiFi", pricingModel: "fixed_monthly", unitPriceMinor: 1500 },
      { code: "PARK", name: "Parking", pricingModel: "fixed_monthly", unitPriceMinor: 3000 },
      { code: "LAUNDRY", name: "Laundry", pricingModel: "per_use", unitPriceMinor: 200, unitLabel: "kg" }
    ]
  });
  await db.parkingSlot.createMany({
    data: [
      { code: "P-A01", propertyId: property.id, monthlyFeeMinor: 3000 },
      { code: "P-A02", propertyId: property.id, monthlyFeeMinor: 3000 }
    ]
  });
  await db.wifiAccount.createMany({
    data: [
      { ssid: "demo-wifi-101", propertyId: property.id, speedLabel: "100 Mbps" },
      { ssid: "demo-wifi-102", propertyId: property.id, speedLabel: "100 Mbps" }
    ]
  });
  console.log("  utilities/services: 2 tariffs · 4 meters · 3 catalog services · 2 slots · 2 WiFi accounts");
}


/// M18: one checklist template per room type (§M18 "sections/items per room type").
async function seedInspectionTemplates(): Promise<void> {
  const general = [
    { title: "Door & locks", items: ["Door closes and locks", "Keys / access cards handed over", "Door peephole intact"] },
    { title: "Walls & ceiling", items: ["Walls clean, no holes", "Ceiling no leaks / stains", "Paint condition acceptable"] },
    { title: "Windows", items: ["Windows open/close", "Screens intact", "Locks work"] },
    { title: "Electrical", items: ["Lights work", "Outlets work", "Breaker panel labeled"] },
    { title: "Water & fixtures", items: ["No leaks under sinks", "Toilet flush + seal", "Shower pressure & drain", "Water heater works"] },
    { title: "Furniture & floor", items: ["Floor clean, no damage", "Furniture inventory complete", "Curtains/blinds intact"] },
    { title: "Safety", items: ["Smoke detector works", "Extinguisher present & charged", "Escape route unobstructed"] },
    { title: "Metering", items: ["Electric meter reading recorded", "Water meter reading recorded"] }
  ];
  const extras: Record<string, Array<{ title: string; items: string[] }>> = {
    DELUXE: [{ title: "Deluxe extras", items: ["Mini-fridge works", "TV + remote works", "A/C cools and drains"] }],
    STUDIO: [{ title: "Studio kitchenette", items: ["Cooktop works", "Range hood extracts", "Microwave works", "A/C cools and drains"] }],
    SUITE: [{ title: "Suite living area", items: ["Sofa set condition", "Dining set condition", "A/C cools and drains", "Balcony door locks"] }]
  };
  const roomTypes = ["STANDARD", "DELUXE", "STUDIO", "SUITE"];
  for (const rt of roomTypes) {
    const sections = rt === "STANDARD" ? general : [...general, ...(extras[rt] ?? extras.DELUXE)];
    await db.inspectionTemplate.upsert({
      where: { name_roomType: { name: "Standard condition checklist", roomType: rt } },
      create: { name: "Standard condition checklist", roomType: rt, sections },
      update: { sections, isActive: true }
    });
  }
}



/// M14/M15/M30: demo suppliers, hierarchical stock categories, stock items
/// (zero on-hand — purchases happen via flows) and POS products linked to
/// stock (§M14 "products link to stock item").
async function seedStockPos(): Promise<void> {
  const property = await db.property.findUniqueOrThrow({ where: { code: "BLR" } });
  const suppliers = [
    { name: "Angkor Wholesale", phone: "+855 12 555 001", email: "orders@angkor-wholesale.test" },
    { name: "Mekong Supplies", phone: "+855 12 555 002", email: "sales@mekong-supplies.test" }
  ];
  for (const sup of suppliers) {
    await db.supplier.upsert({ where: { name: sup.name }, create: sup, update: sup });
  }

  // M30 category hierarchy (shared catalogue + BLR-owned stock categories).
  const catDefs: Array<{ name: string; parent?: string; shared?: boolean }> = [
    { name: "Beverages" },
    { name: "Cold", parent: "Beverages" },
    { name: "Hot", parent: "Beverages" },
    { name: "Snacks" },
    { name: "Groceries" },
    { name: "Cleaning", shared: true },
    { name: "Parts", shared: true }
  ];
  const catIds = new Map<string, string>();
  for (const def of catDefs) {
    const parent = def.parent ? catIds.get(def.parent) ?? null : null;
    const propertyId = def.shared ? null : property.id;
    const existing = await db.stockCategory.findFirst({ where: { name: def.name, parentId: parent, propertyId } });
    const cat = existing
      ? await db.stockCategory.update({ where: { id: existing.id }, data: { parentId: parent, propertyId, sortOrder: catIds.size, isActive: true } })
      : await db.stockCategory.create({ data: { name: def.name, parentId: parent, propertyId, sortOrder: catIds.size } });
    catIds.set(def.name, cat.id);
  }

  const items: Array<{ name: string; categoryId: string; unit: string; packUnit?: string; packSize?: number; minQtyMilli: number; supplier: string; priceMinor: number; barcode?: string }> = [
    { name: "Coca-Cola can 330ml", categoryId: "Cold", unit: "can", packUnit: "carton", packSize: 12, minQtyMilli: 12_000, supplier: "Angkor Wholesale", priceMinor: 100, barcode: "8890000001006" },
    { name: "Drinking water 1.5L", categoryId: "Cold", unit: "bottle", packUnit: "case", packSize: 24, minQtyMilli: 24_000, supplier: "Angkor Wholesale", priceMinor: 60, barcode: "8890000002003" },
    { name: "Instant noodles pack", categoryId: "Snacks", unit: "pcs", minQtyMilli: 10_000, supplier: "Mekong Supplies", priceMinor: 150, barcode: "8890000003000" },
    { name: "Laundry detergent 1kg", categoryId: "Cleaning", unit: "box", minQtyMilli: 4_000, supplier: "Mekong Supplies", priceMinor: 450, barcode: "8890000004007" },
    { name: "Coffee beans", categoryId: "Hot", unit: "kg", minQtyMilli: 2_000, supplier: "Angkor Wholesale", priceMinor: 1200, barcode: "8890000005004" }
  ];
  for (const it of items) {
    const supplier = await db.supplier.findUniqueOrThrow({ where: { name: it.supplier } });
    const categoryId = catIds.get(it.categoryId) ?? null;
    const categoryPath = catDefs.find((c) => c.name === it.categoryId)?.parent
      ? `${catDefs.find((c) => c.name === it.categoryId)?.parent}/${it.categoryId}`
      : it.categoryId;
    const item = await db.stockItem.upsert({
      where: { name_propertyId: { name: it.name, propertyId: property.id } },
      create: { name: it.name, category: categoryPath, categoryId, unit: it.unit, packUnit: it.packUnit ?? null, packSize: it.packSize ?? null, minQtyMilli: it.minQtyMilli, supplierId: supplier.id, propertyId: property.id },
      update: { minQtyMilli: it.minQtyMilli, supplierId: supplier.id, category: categoryPath, categoryId, unit: it.unit, packUnit: it.packUnit ?? null, packSize: it.packSize ?? null, isActive: true }
    });
    await db.posProduct.upsert({
      where: { name: it.name },
      create: { name: it.name, priceMinor: it.priceMinor, category: categoryPath, categoryId, barcode: it.barcode ?? null, stockItemId: item.id, isActive: true },
      update: { priceMinor: it.priceMinor, category: categoryPath, categoryId, barcode: it.barcode ?? null, stockItemId: item.id, isActive: true }
    });
  }
  await db.posProduct.upsert({
    where: { name: "Print / scan service" },
    create: { name: "Print / scan service", priceMinor: 25, category: "Service", isActive: true },
    update: { priceMinor: 25, isActive: true }
  });
}




/// M23: BLR kiosk geofence, morning/evening shift templates, the ×1.5 overtime
/// rule and demo kiosk PINs (PINs are sha256(pepper:pin) — indexed lookup by
/// design; see attendance-service). Documented demo PINs: staff 246810,
/// pm 135711, root 112233.
async function seedAttendance(): Promise<void> {
  const property = await db.property.findUniqueOrThrow({ where: { code: "BLR" } });
  await db.property.update({
    where: { id: property.id },
    data: { geoLat: 11.5564, geoLng: 104.9282, geofenceRadiusM: 200 }
  });
  const shifts = [
    { name: "Morning 08:00–16:00", startMinute: 480, endMinute: 960, graceMinutes: 10 },
    { name: "Evening 16:00–24:00", startMinute: 960, endMinute: 1440, graceMinutes: 10 }
  ];
  for (const sh of shifts) {
    await db.shift.upsert({
      where: { propertyId_name: { propertyId: property.id, name: sh.name } },
      create: { propertyId: property.id, ...sh },
      update: { ...sh, isActive: true }
    });
  }
  await db.overtimeRule.upsert({
    where: { propertyId: property.id },
    create: { propertyId: property.id, afterMinutes: 0, multiplierBp: 15000 },
    update: { afterMinutes: 0, multiplierBp: 15000, isActive: true }
  });
  const pepper = process.env.KIOSK_PIN_PEPPER ?? "rm-kiosk-pepper-v1";
  const pinHash = (pin: string) => createHash("sha256").update(`${pepper}:${pin}`).digest("hex");
  const pins: Array<{ email: string; pin: string }> = [
    { email: "staff@demo.test", pin: "246810" },
    { email: "pm@demo.test", pin: "135711" },
    { email: "root@demo.test", pin: "112233" }
  ];
  for (const p of pins) {
    await db.user.update({ where: { email: p.email }, data: { kioskPinHash: pinHash(p.pin) } });
  }
}




/// M20: BLR expense categories mapped to the ledger expense accounts, monthly
/// budgets for two of them (P&L budget-variance demo), a recurring internet
/// template, and the default approval threshold setting ($500).
async function seedExpenses(): Promise<void> {
  const property = await db.property.findUniqueOrThrow({ where: { code: "BLR" } });
  const categories: Array<{ name: string; accountCode: string }> = [
    { name: "Property utilities", accountCode: "5000" },
    { name: "Internet & WiFi", accountCode: "5000" },
    { name: "Repairs & maintenance", accountCode: "5000" },
    { name: "Cleaning & supplies", accountCode: "5000" },
    { name: "Bank fees", accountCode: "5100" }
  ];
  for (const c of categories) {
    await db.expenseCategory.upsert({
      where: { propertyId_name: { propertyId: property.id, name: c.name } },
      create: { propertyId: property.id, ...c },
      update: { accountCode: c.accountCode, isActive: true }
    });
  }
  const budgets: Array<{ name: string; amountMinor: number }> = [
    { name: "Internet & WiFi", amountMinor: 30_000 },
    { name: "Repairs & maintenance", amountMinor: 100_000 }
  ];
  const month = new Date().toISOString().slice(0, 7);
  for (const b of budgets) {
    const cat = await db.expenseCategory.findUniqueOrThrow({ where: { propertyId_name: { propertyId: property.id, name: b.name } } });
    await db.expenseBudget.upsert({
      where: { categoryId_month: { categoryId: cat.id, month } },
      create: { categoryId: cat.id, month, amountMinor: b.amountMinor },
      update: { amountMinor: b.amountMinor }
    });
  }
  const internet = await db.expenseCategory.findUniqueOrThrow({ where: { propertyId_name: { propertyId: property.id, name: "Internet & WiFi" } } });
  const existingRecurring = await db.recurringExpense.findFirst({ where: { propertyId: property.id, vendorName: "Orange Fibre" } });
  if (!existingRecurring) {
    await db.recurringExpense.create({
      data: {
        propertyId: property.id,
        categoryId: internet.id,
        vendorName: "Orange Fibre",
        description: "Monthly fibre subscription",
        amountMinor: 22_000,
        paidVia: "bank_transfer",
        dayOfMonth: 5
      }
    });
  }
  await db.setting.upsert({
    where: { key: "expenses.approvalThresholdMinor" },
    create: { key: "expenses.approvalThresholdMinor", value: "50000" },
    update: {}
  });
}




/// M24: chargeTo classification for the expense categories (pass-through and
/// owner-borne maintenance reduce the owner payout) + the configurable
/// generation day (§M24 "generation job (configurable day)").
async function seedStatements(): Promise<void> {
  const property = await db.property.findUniqueOrThrow({ where: { code: "BLR" } });
  await db.expenseCategory.update({
    where: { propertyId_name: { propertyId: property.id, name: "Internet & WiFi" } },
    data: { chargeTo: "passthrough" }
  });
  await db.expenseCategory.update({
    where: { propertyId_name: { propertyId: property.id, name: "Repairs & maintenance" } },
    data: { chargeTo: "owner_maintenance" }
  });
  await db.setting.upsert({
    where: { key: "statements.generationDay" },
    create: { key: "statements.generationDay", value: "5" },
    update: {}
  });
}




/// M25: portal announcements (property-scoped + global). Members read them on
/// the tenant-portal dashboard; management UI ships with M26/M28.
async function seedPortal(): Promise<void> {
  // db:reset seeds twice (migrate reset + db:seed) — announcements have no
  // natural unique key, so guard instead of upsert.
  if ((await db.announcement.count()) > 0) return;
  const blr = await db.property.findUniqueOrThrow({ where: { code: "BLR" } });
  await db.announcement.create({ data: { propertyId: blr.id, title: "Water shutdown Thursday 9–11am", body: "Building A water supply is paused for pump maintenance. Tanks are topped up — short pressure drops possible." } });
  await db.announcement.create({ data: { title: "Welcome to the resident portal", body: "Pay rent by QR, raise maintenance tickets and track complaints right from your phone." } });
}

/// M32: default global rent modules + progressive rate ladders. Idempotent by
/// unique slug / (moduleId, toMinutes, scope) — re-seeding never duplicates.
async function seedStay(): Promise<void> {
  const existing = await db.rentModule.count();
  if (existing > 0) return;

  const hourly = await db.rentModule.create({
    data: {
      name: "Hourly", slug: "hourly",
      billingStrategy: "progressive",
      minDurationMinutes: 120, maxDurationMinutes: 1440,
      minGuests: 1, maxGuests: 4, sortOrder: 10
    }
  });
  const overnight = await db.rentModule.create({
    data: {
      name: "Overnight", slug: "overnight",
      billingStrategy: "progressive",
      minDurationMinutes: 720, maxDurationMinutes: 2160,
      minGuests: 1, maxGuests: 3, sortOrder: 20
    }
  });
  const dayuse = await db.rentModule.create({
    data: {
      name: "Day-use", slug: "dayuse",
      billingStrategy: "blended",
      minDurationMinutes: 1440, maxDurationMinutes: 10080,
      defaultDepositMinor: 2000,
      minGuests: 1, maxGuests: 6, sortOrder: 30
    }
  });

  const ladders: Record<string, Array<[number, number]>> = {
    hourly: [[240, 2200], [480, 3800], [720, 5200], [960, 6400], [1200, 7600], [1440, 8800]],
    overnight: [[1440, 12000], [2160, 18000]],
    dayuse: [[720, 6800], [1440, 12000], [2880, 21600], [4320, 31200], [5760, 40800], [7200, 50400], [8640, 60000], [10080, 69600]]
  };
  for (const [slug, ladder] of Object.entries(ladders)) {
    const mod = slug === "hourly" ? hourly : slug === "overnight" ? overnight : dayuse;
    await db.stayRateRule.createMany({
      data: ladder.map(([toMinutes, priceMinor]) => ({ moduleId: mod.id, toMinutes, priceMinor, effectiveFrom: new Date("2026-01-01T00:00:00.000Z") }))
    });
  }
}

async function main(): Promise<void> {
  const cellsUsed = Object.values(MATRIX).reduce((n, m) => n + Object.keys(m).length, 0);
  await seedSettings();
  await seedInspectionTemplates();
  await seedPermissions();
  await seedRoles();
  await seedProperties(); // before users — seedUsers links propertyCodes → assignments
  await seedUsers();
  await seedDocTypes();
  await seedMembers();
  await seedOwners();
  await seedLeases();
  await seedBilling();
  await seedLedgerAccounts();
  await seedUtilitiesServices();
  await seedStockPos();
  await seedAttendance();
  await seedExpenses();
  await seedStatements();
  await seedPortal();
  await seedStay();
  await db.auditLog.create({
    data: {
      actorName: "system",
      module: "M00",
      action: "seed",
      entityType: "system",
      summary: `Seed completed: ${MODULES.length * ACTIONS.length} permissions, ${DEFAULT_ROLES.length} roles, ${DEMO_USERS.length} users, ${DEMO_MEMBERS.length} members, ${cellsUsed} matrix cells`
    }
  });
  console.log("Seed complete.");
  console.log(`  permissions: ${MODULES.length * ACTIONS.length}`);
  console.log(`  roles: ${DEFAULT_ROLES.map((r) => r.key).join(", ")}`);
  console.log(`  demo login: root@demo.test / ${DEMO_PASSWORD} (also admin@, pm@, accountant@, staff@, owner@demo.test)`);
  console.log(`  members: ${DEMO_MEMBERS.length} demo members with KYC documents`);
  console.log(`  owners: ${DEMO_OWNERS.length} demo owners with payout methods + building ownership`);
  console.log("  leases: LSE-0001 active (Chan Ling, mid-month start) · LSE-0002 draft · OWC-0001/0002 owner contracts");
  console.log("  portal: 2 announcements · OTP login for members (M25)");
  console.log("  billing: 4 rent plans · late fee $5 after 3d grace · tax 0% · dunning +3/+7/+14");
  console.log("  ledger: 14 system accounts (1100–5100 + 3900 distributions), append-only postings");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
