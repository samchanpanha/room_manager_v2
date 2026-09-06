/// Full client-demo dataset (SEED_FULL_DEMO=1).
/// Runs on top of the baseline seed (prisma/seed.ts) and fills every module
/// with coherent, internally-consistent sample data:
///   members, leases, billing history (invoices/payments/credit notes),
///   deposits (held + settled), utilities, services, room moves,
///   inspections, maintenance, complaints, POS + stock + POs, expenses,
///   owner statements, attendance, short-stays, M21/M25/M33 touchpoints.
///
/// Guard rails:
///   - guarded by the `demo.full` setting → exactly once per (re)seed;
///   - every monetary row keeps `amountDue == total - paid - credited`;
///   - every invoice/payment/deposit/expense/statement posts a BALANCED
///     double-entry transaction via the same ledger service the app uses,
///     so the ledger, member statements and trial balance tell one story;
///   - number-sequences are re-synced from the rows we inserted, so the app
///     keeps numbering without collisions after the demo.
import { Prisma, type PrismaClient } from "@prisma/client";
import { randomBytes } from "node:crypto";
import { ACC } from "../src/lib/ledger/accounts";
import { creditNoteLines, invoiceIssueLines, lateFeeLines } from "../src/lib/ledger/postings";
import { postTransaction } from "../src/lib/ledger/service";
import { settlementAccountCode } from "../src/lib/payments/machines";

const DAY = 86_400_000;

/// UTC first-of-month helper (avoids TZ drift — everything is stored UTC).
function firstOfMonth(d: Date, offsetMonths = 0): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + offsetMonths, 1));
}
const thisMonth = () => firstOfMonth(new Date());
const monthN = (n: number) => firstOfMonth(new Date(), n);

/// [periodStart, periodEnd) for the previous / current billing month (cycle day 1).
const prevMonth: [Date, Date] = [monthN(-1), thisMonth()];
const curMonth: [Date, Date] = [thisMonth(), monthN(1)];

/// "2026-08" style label.
const ym = (d: Date) => `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
const lastMonthLabel = ym(monthN(-1));

/// Number contexts threaded through seeding (uniqueness within the demo).
class Numbers {
  pmt = 0;
  rcp = 0;
  inv: Record<string, number> = {}; // per property code
}

async function seedFullDemo(db: PrismaClient): Promise<void> {
  const marker = await db.setting.findUnique({ where: { key: "demo.full" } });
  if (marker) {
    console.log("  demo data: already present (demo.full marker) — skipping");
    return;
  }

  const nums = new Numbers();
  const now = new Date();
  const today = firstOfMonth(now);

  // ── resolve existing baseline rows we build on ──────────────────────────
  const blr = await db.property.findUniqueOrThrow({ where: { code: "BLR" } });
  const rv = await db.property.findUniqueOrThrow({ where: { code: "RV" } });
  const bldgA = await db.building.findFirstOrThrow({ where: { name: "Building A" } });
  const villa = await db.building.findFirstOrThrow({ where: { name: "Villa Main" } });

  const room = (floorName: string, number: string) =>
    db.room.findFirstOrThrow({ where: { number, floor: { name: floorName } } });
  const rA101 = await room("Floor 1", "A1-01");
  const rA102 = await room("Floor 1", "A1-02");
  const rA103 = await room("Floor 1", "A1-03");
  const rA104 = await room("Floor 1", "A1-04");
  const rA201 = await room("Floor 2", "A2-01");
  const rA202 = await room("Floor 2", "A2-02");
  const rA203 = await room("Floor 2", "A2-03");
  const rA204 = await room("Floor 2", "A2-04");
  const rA301 = await room("Floor 3", "A3-01");
  const rA302 = await room("Floor 3", "A3-02");
  const rA303 = await room("Floor 3", "A3-03");
  const rA304 = await room("Floor 3", "A3-04");
  const rG01 = await room("Ground", "G0-01");
  const rG02 = await room("Ground", "G0-02");
  const rG03 = await room("Ground", "G0-03");
  const rV01 = await room("Ground", "V-01");
  const rV02 = await room("Ground", "V-02");

  const admin = await db.user.findUniqueOrThrow({ where: { email: "admin@demo.test" } });
  const accountant = await db.user.findUniqueOrThrow({ where: { email: "accountant@demo.test" } });
  const staff = await db.user.findUniqueOrThrow({ where: { email: "staff@demo.test" } });
  const pm = await db.user.findUniqueOrThrow({ where: { email: "pm@demo.test" } });
  const root = await db.user.findUniqueOrThrow({ where: { email: "root@demo.test" } });

  const deluxe = await db.rentPlan.findUniqueOrThrow({ where: { name: "Deluxe Room" } });
  const studio = await db.rentPlan.findUniqueOrThrow({ where: { name: "Studio" } });
  const suite = await db.rentPlan.findUniqueOrThrow({ where: { name: "Suite" } });
  const standard = await db.rentPlan.findUniqueOrThrow({ where: { name: "Standard Room" } });

  const wifi = await db.serviceCatalog.findUniqueOrThrow({ where: { code: "WIFI" } });
  const park = await db.serviceCatalog.findUniqueOrThrow({ where: { code: "PARK" } });
  const laundry = await db.serviceCatalog.findUniqueOrThrow({ where: { code: "LAUNDRY" } });

  const remarksSummary: string[] = [];

  // ── helpers: issue an invoice + its balanced accrual posting ─────────────
  async function issueInvoice(opts: {
    propertyId: string;
    memberProfileId: string;
    leaseId?: string | null;
    periodStart: Date;
    periodEnd: Date;
    dueDate: Date;
    items: Array<{ kind: string; name: string; unitMinor: number; qty?: number }>;
    discountMinor?: number;
    taxMinor?: number;
    issuedAt?: Date;
    isDeposit?: boolean;
    status?: string;
    dunningStage?: number;
    notes?: string;
    propertyCode: string;
  }): Promise<any> {
    const prop = opts.propertyCode;
    nums.inv[prop] = (nums.inv[prop] ?? 0) + 1;
    const code = `${prop}-2026-${String(nums.inv[prop]).padStart(4, "0")}`;
    const discountMinor = opts.discountMinor ?? 0;
    const taxMinor = opts.taxMinor ?? 0;
    const subtotal = opts.items.reduce((s, i) => s + i.unitMinor * (i.qty ?? 1), 0);
    const total = subtotal + taxMinor - discountMinor;
    const invoice = await db.invoice.create({
      data: {
        code,
        propertyId: opts.propertyId,
        leaseId: opts.leaseId ?? null,
        memberProfileId: opts.memberProfileId,
        status: opts.status ?? "issued",
        periodStart: opts.periodStart,
        periodEnd: opts.periodEnd,
        issuedAt: opts.issuedAt ?? new Date(),
        dueDate: opts.dueDate,
        subtotalMinor: subtotal,
        discountMinor,
        taxMinor,
        totalMinor: total,
        amountPaidMinor: 0,
        amountCreditedMinor: 0,
        amountDueMinor: total,
        dunningStage: opts.dunningStage ?? 0,
        isDeposit: opts.isDeposit ?? false,
        notes: opts.notes ?? null,
        items: {
          create: opts.items.map((i) => ({
            kind: i.kind,
            name: i.name,
            qty: i.qty ?? 1,
            unitMinor: i.unitMinor,
            amountMinor: i.unitMinor * (i.qty ?? 1)
          }))
        }
      },
      include: { items: true }
    });
    const member = await db.memberProfile.findUniqueOrThrow({ where: { id: opts.memberProfileId }, include: { party: true } });
    await postTransaction(db, {
      memo: `Invoice ${code} issued to ${member.party.name}${opts.isDeposit ? " — security deposit" : ""}`,
      refType: "invoice",
      refId: invoice.id,
      propertyId: opts.propertyId,
      memberId: opts.memberProfileId,
      actorId: null,
      lines: invoiceIssueLines({
        totalMinor: total,
        discountMinor,
        taxMinor,
        items: invoice.items.map((i) => ({ kind: i.kind, amountMinor: i.amountMinor }))
      })
    });
    return invoice;
  }

  /// Confirm a payment against one invoice (creates Payment + allocation +
  /// keeps invoice.amountDueMinor internally consistent + posts the ledger leg).
  async function payInvoice(opts: {
    invoice: any;
    memberProfileId: string;
    method: "cash" | "bank_transfer" | "qr";
    amountMinor?: number;
    receivedAt: Date;
  }): Promise<{ payment: any; paidMinor: number }> {
    const paidMinor = opts.amountMinor ?? opts.invoice.amountDueMinor;
    if (paidMinor <= 0) throw new Error("payInvoice: nothing to pay");
    const dueAfter = Math.max(0, opts.invoice.amountDueMinor - paidMinor);
    const newPaid = opts.invoice.amountPaidMinor + paidMinor;
    const status = dueAfter === 0 ? "paid" : "partial_paid";

    nums.pmt += 1;
    nums.rcp += 1;
    const code = `PMT-2026-${String(nums.pmt).padStart(4, "0")}`;
    const receiptCode = `RCP-2026-${String(nums.rcp).padStart(4, "0")}`;
    const payment = await db.payment.create({
      data: {
        code,
        memberProfileId: opts.memberProfileId,
        propertyId: opts.invoice.propertyId,
        method: opts.method,
        status: "confirmed",
        amountMinor: paidMinor,
        remainingMinor: 0,
        refundedMinor: 0,
        receiptCode,
        receivedAt: opts.receivedAt,
        confirmedAt: opts.receivedAt,
        allocations: { create: [{ invoiceId: opts.invoice.id, amountMinor: paidMinor }] }
      }
    });
    const member = await db.memberProfile.findUniqueOrThrow({ where: { id: opts.memberProfileId }, include: { party: true } });
    await postTransaction(db, {
      memo: `Payment ${code} from ${member.party.name} (${opts.method}) — receipt ${receiptCode}`,
      refType: "payment",
      refId: payment.id,
      propertyId: opts.invoice.propertyId,
      memberId: opts.memberProfileId,
      actorId: null,
      lines: [
        { code: settlementAccountCode(opts.method), debit: paidMinor, credit: 0 },
        { code: ACC.RENT_RECEIVABLE, debit: 0, credit: paidMinor }
      ]
    });
    await db.invoice.update({
      where: { id: opts.invoice.id },
      data: {
        amountPaidMinor: newPaid,
        amountDueMinor: dueAfter,
        status: opts.invoice.status === "void" ? opts.invoice.status : status
      }
    });
    return { payment, paidMinor };
  }

  /// One demo member + verified KYC (doc entry) + emergency contact.
  async function addMember(opts: {
    email: string;
    name: string;
    phone: string;
    nationality: string;
    idNumber: string;
    occupation: string;
    propertyId: string;
    contact: { name: string; relationship: string; phone: string };
  }): Promise<any> {
    const party = await db.party.create({
      data: { id: `party_${opts.email}`, type: "PERSON", name: opts.name, email: opts.email, phone: opts.phone }
    });
    return db.memberProfile.create({
      data: {
        partyId: party.id,
        status: "active",
        homePropertyId: opts.propertyId,
        nationality: opts.nationality,
        idNumber: opts.idNumber,
        occupation: opts.occupation,
        kycCompletedAt: new Date(),
        emergencyContacts: { create: opts.contact }
      }
    });
  }

  // ═════════════════════════════ M02/M05 MEMBERS + LEASES ═════════════════════════
  const ling = await db.memberProfile.findFirstOrThrow({ where: { party: { email: "chan.ling@example.test" } } });
  const sophea = await db.memberProfile.findFirstOrThrow({ where: { party: { email: "sophea.nuon@example.test" } } });

  const sokha = await addMember({
    email: "sokha.preap@example.test", name: "Sokha Preap", phone: "+855 12 555 301", nationality: "Khmer",
    idNumber: "KH-112289", occupation: "Hotel front-desk supervisor", propertyId: blr.id,
    contact: { name: "Preap Dara", relationship: "Father", phone: "+855 12 555 302" }
  });
  const petra = await addMember({
    email: "petra.novak@example.test", name: "Petra Novak", phone: "+855 70 555 401", nationality: "Czech",
    idNumber: "CZ-778833", occupation: "UX designer (remote)", propertyId: blr.id,
    contact: { name: "Tom Novak", relationship: "Brother", phone: "+855 70 555 402" }
  });
  const meng = await addMember({
    email: "meng.leang@example.test", name: "Meng Leang", phone: "+855 92 555 501", nationality: "Khmer",
    idNumber: "KH-667780", occupation: "Restaurant owner", propertyId: blr.id,
    contact: { name: "Leang Sokun", relationship: "Mother", phone: "+855 92 555 502" }
  });
  const isabella = await addMember({
    email: "isabella.moreau@example.test", name: "Isabella Moreau", phone: "+855 10 555 601", nationality: "French",
    idNumber: "FR-334455", occupation: "Teacher — French institute", propertyId: blr.id,
    contact: { name: "Lucas Moreau", relationship: "Spouse", phone: "+855 10 555 602" }
  });
  const rith = await addMember({
    email: "rith.somnang@example.test", name: "Rith Somnang", phone: "+855 11 555 701", nationality: "Khmer",
    idNumber: "KH-441122", occupation: "Bank teller", propertyId: blr.id,
    contact: { name: "Somnang Chea", relationship: "Sister", phone: "+855 11 555 702" }
  });
  const hana = await addMember({
    email: "hana.takahashi@example.test", name: "Hana Takahashi", phone: "+855 16 555 801", nationality: "Japanese",
    idNumber: "JP-889900", occupation: "NGO program officer", propertyId: blr.id,
    contact: { name: "Kenji Takahashi", relationship: "Father", phone: "+855 16 555 802" }
  });
  const nun = await addMember({
    email: "nun.sokha@example.test", name: "Nun Sokha", phone: "+855 89 555 901", nationality: "Khmer",
    idNumber: "KH-778866", occupation: "Export consultant", propertyId: rv.id,
    contact: { name: "Nun Kimleng", relationship: "Spouse", phone: "+855 89 555 902" }
  });

  const lease = (code: string) => db.lease.findUnique({ where: { code } });
  const lse1 = await lease("LSE-0001").then((l) => l!.id);
  const lse1Lease = await db.lease.findUniqueOrThrow({ where: { code: "LSE-0001" } });

  const leaseCore = {
    billingCycleDay: 1,
    prorationBasis: "calendar" as const,
    depositInstallments: 1,
    noticeDays: 30
  };

  // Active leases (each with a **previous-month** + **current-month** invoice below).
  const L3 = await db.lease.create({
    data: {
      code: "LSE-0003", memberProfileId: sokha.id, roomId: rA103.id, propertyId: blr.id,
      status: "active", startDate: monthN(-2), rentAmountMinor: 25000, depositTotalMinor: 25000,
      ...leaseCore, rentPlanId: deluxe.id,
      services: { create: [{ name: "WiFi", amountMinor: 1500, pricingModel: "fixed_monthly" }, { name: "Parking", amountMinor: 3000, pricingModel: "fixed_monthly" }] }
    }
  });
  await db.room.update({ where: { id: rA103.id }, data: { status: "occupied" } });
  await db.memberProfile.update({ where: { id: sokha.id }, data: { status: "active" } });

  const L4 = await db.lease.create({
    data: {
      code: "LSE-0004", memberProfileId: petra.id, roomId: rA202.id, propertyId: blr.id,
      status: "active", startDate: monthN(-2), rentAmountMinor: 25000, depositTotalMinor: 25000,
      ...leaseCore, rentPlanId: deluxe.id,
      services: { create: [{ name: "WiFi", amountMinor: 1500, pricingModel: "fixed_monthly" }, { name: "Parking", amountMinor: 3000, pricingModel: "fixed_monthly" }] }
    }
  });
  await db.room.update({ where: { id: rA202.id }, data: { status: "occupied" } });
  await db.memberProfile.update({ where: { id: petra.id }, data: { status: "active" } });

  // Meng: room-move demo — old lease on G0-02 (terminated) → new lease on A2-01.
  const oldMeng = await db.lease.create({
    data: {
      code: "LSE-0004B", memberProfileId: meng.id, roomId: rG02.id, propertyId: blr.id,
      status: "terminated", startDate: monthN(-3), endDate: monthN(-2), rentAmountMinor: 18000, depositTotalMinor: 18000,
      rentPlanId: standard.id, billingCycleDay: 1, prorationBasis: "calendar", noticeDays: 30,
      terminationReason: "Room move to A2-01", terminatedAt: monthN(-2)
    }
  });
  await db.memberProfile.update({ where: { id: meng.id }, data: { status: "active" } });
  const L5 = await db.lease.create({
    data: {
      code: "LSE-0005", memberProfileId: meng.id, roomId: rA201.id, propertyId: blr.id,
      status: "active", startDate: monthN(-2), rentAmountMinor: 25000, depositTotalMinor: 25000,
      ...leaseCore, rentPlanId: deluxe.id
    }
  });
  await db.room.update({ where: { id: rA201.id }, data: { status: "occupied" } });

  const L6 = await db.lease.create({
    data: {
      code: "LSE-0006", memberProfileId: isabella.id, roomId: rA302.id, propertyId: blr.id,
      status: "active", startDate: monthN(-2), rentAmountMinor: 32000, depositTotalMinor: 32000,
      ...leaseCore, rentPlanId: studio.id
    }
  });
  await db.room.update({ where: { id: rA302.id }, data: { status: "occupied" } });
  await db.memberProfile.update({ where: { id: isabella.id }, data: { status: "active" } });

  // Rith: on notice → move-out inspection pending.
  const L7 = await db.lease.create({
    data: {
      code: "LSE-0007", memberProfileId: rith.id, roomId: rA301.id, propertyId: blr.id,
      status: "notice", startDate: monthN(-2), endDate: monthN(1), rentAmountMinor: 32000, depositTotalMinor: 32000,
      ...leaseCore, rentPlanId: studio.id, terminationReason: null, nextBillingDate: null
    }
  });
  await db.room.update({ where: { id: rA301.id }, data: { status: "occupied" } });
  await db.memberProfile.update({ where: { id: rith.id }, data: { status: "notice" } });

  // Hana: moved out — terminated lease, settled deposit.
  const L8 = await db.lease.create({
    data: {
      code: "LSE-0008", memberProfileId: hana.id, roomId: rA104.id, propertyId: blr.id,
      status: "terminated", startDate: monthN(-5), endDate: monthN(-1), rentAmountMinor: 25000, depositTotalMinor: 25000,
      ...leaseCore, rentPlanId: deluxe.id, terminationReason: "End of contract", terminatedAt: monthN(-1)
    }
  });
  await db.memberProfile.update({ where: { id: hana.id }, data: { status: "moved_out" } });

  // RV: Nun on the villa suite.
  const L9 = await db.lease.create({
    data: {
      code: "LSE-0009", memberProfileId: nun.id, roomId: rV01.id, propertyId: rv.id,
      status: "active", startDate: monthN(-2), rentAmountMinor: 45000, depositTotalMinor: 45000,
      ...leaseCore, rentPlanId: suite.id
    }
  });
  await db.room.update({ where: { id: rV01.id }, data: { status: "occupied" } });
  await db.memberProfile.update({ where: { id: nun.id }, data: { status: "active" } });

  // Extra room-status variety for the occupancy dashboard.
  await db.room.update({ where: { id: rA203.id }, data: { status: "cleaning" } });
  await db.room.update({ where: { id: rA303.id }, data: { status: "maintenance", notes: "Ceiling leak fix in progress" } });
  await db.room.update({ where: { id: rV02.id }, data: { status: "cleaning" } });

  // ═══════════════════════ M10 DEPOSITS (held + billed + settled) ═══════════════════════
  const deposit = async (leaseId: string, memberId: string, propertyId: string, requiredMinor: number, opts: { billed?: boolean; settled?: boolean }) => {
    const inv = await issueInvoice({
      propertyId, memberProfileId: memberId, leaseId, propertyCode: propertyId === rv.id ? "RV" : "BLR",
      periodStart: leaseId === lse1 ? new Date(Date.UTC(monthN(-1).getUTCFullYear(), monthN(-1).getUTCMonth(), 15)) : monthN(-2),
      periodEnd: leaseId === lse1 ? monthN(0) : monthN(-1),
      dueDate: monthN(-2), isDeposit: true, notes: "Security deposit (1 month rent)",
      items: [{ kind: "deposit", name: "Security deposit", unitMinor: requiredMinor }]
    });
    if (!opts.billed) {
      await payInvoice({ invoice: inv, memberProfileId: memberId, method: "bank_transfer", receivedAt: new Date(monthN(-2).getTime() + 2 * DAY) });
    }
    return db.deposit.create({
      data: {
        leaseId, memberProfileId: memberId, propertyId, requiredMinor,
        status: opts.settled ? "settled" : opts.billed ? "billed" : "held",
        invoiceId: inv.id
      }
    });
  };
  await deposit(lse1, ling.id, blr.id, 50000, {});
  await deposit(L3.id, sokha.id, blr.id, 25000, {});
  await deposit(L4.id, petra.id, blr.id, 25000, {});
  await deposit(L5.id, meng.id, blr.id, 25000, {});
  await deposit(L6.id, isabella.id, blr.id, 32000, {});
  await deposit(L7.id, rith.id, blr.id, 32000, {});
  const d8 = await deposit(L8.id, hana.id, blr.id, 25000, {});
  await deposit(L9.id, nun.id, rv.id, 45000, {});
  // Sophea: draft lease holds a **billed but unpaid** deposit (pipeline demo).
  const sopheaDraftLease = await db.lease.findFirstOrThrow({ where: { memberProfileId: sophea.id } });
  await deposit(sopheaDraftLease.id, sophea.id, blr.id, 50000, { billed: true });

  // Hana's settled deposit: deduction (damage, evidence ref) + cash refund.
  await db.depositTransaction.create({
    data: {
      depositId: d8.id, type: "deduction", amountMinor: 15000, reason: "damage",
      note: "Move-out: curtain rail torn in Room A1-04 (per inspection INSP-2026-0003)", method: null
    }
  });
  await db.depositTransaction.create({
    data: { depositId: d8.id, type: "refund", amountMinor: 10000, reason: null, note: "Deposit refund after 15.00 damage deduction", method: "cash" }
  });
  await postTransaction(db, {
    memo: `Deposit deduction (damage) on LSE-0008: move-out damage — curtain rail (INSP-2026-0003)`,
    refType: "deposit_deduction", refId: d8.id, propertyId: blr.id, memberId: hana.id, actorId: accountant.id,
    lines: [
      { code: ACC.DEPOSIT_LIABILITY, debit: 15000, credit: 0 },
      { code: ACC.OTHER_REVENUE, debit: 0, credit: 15000, memo: "damage" }
    ]
  });
  await postTransaction(db, {
    memo: `Deposit refund on LSE-0008 (Hana Takahashi): cash refund of the held remainder`,
    refType: "deposit_refund", refId: d8.id, propertyId: blr.id, memberId: hana.id, actorId: accountant.id,
    lines: [
      { code: ACC.DEPOSIT_LIABILITY, debit: 10000, credit: 0 },
      { code: ACC.CASH, debit: 0, credit: 10000 }
    ]
  });

  // ═══════════════════════ M07/M09 BILLING HISTORY ═══════════════════════
  let collectedAugBlr = 0; // feeds the M24 owner statement
  const rentItem = (rent: number) => ({ kind: "rent" as const, name: "Monthly rent", unitMinor: rent });
  const svcItem = (name: string, amt: number) => ({ kind: "service" as const, name, unitMinor: amt });
  const utilItem = (name: string, amt: number) => ({ kind: "utility" as const, name, unitMinor: amt });
  const payPrev = (inv: any, memberId: string, method: "cash" | "qr" | "bank_transfer" = "bank_transfer") =>
    payInvoice({ invoice: inv, memberProfileId: memberId, method, receivedAt: new Date(monthN(-1).getTime() + 3 * DAY) });

  // ── previous month (all settled) ──
  // LSE-0001 (Ling): prorated mid-month move-in (15 Aug → 31 Aug).
  const lingStart = new Date(Math.max(prevMonth[0].getTime(), lse1Lease.startDate.getTime()));
  const lingPrev = await issueInvoice({
    propertyCode: "BLR", propertyId: blr.id, memberProfileId: ling.id, leaseId: lse1,
    periodStart: lingStart,
    periodEnd: prevMonth[1], dueDate: prevMonth[1],
    items: [
      rentItem(13710),
      { kind: "service", name: "WiFi — prorated (move-in 15 Aug)", unitMinor: 823 }
    ],
    issuedAt: new Date(lingStart.getTime() + 13 * DAY),
    status: "paid"
  });
  const lp1 = await payInvoice({ invoice: lingPrev, memberProfileId: ling.id, method: "cash", receivedAt: new Date(lingStart.getTime() + 15 * DAY) });
  collectedAugBlr += lp1.paidMinor;

  const sokhaPrev = await issueInvoice({
    propertyCode: "BLR", propertyId: blr.id, memberProfileId: sokha.id, leaseId: L3.id,
    periodStart: prevMonth[0], periodEnd: prevMonth[1], dueDate: prevMonth[0],
    items: [rentItem(25000), svcItem("WiFi", 1500), svcItem("Parking", 3000)]
  });
  const lp2 = await payPrev(sokhaPrev, sokha.id);
  collectedAugBlr += lp2.paidMinor;

  const petraPrev = await issueInvoice({
    propertyCode: "BLR", propertyId: blr.id, memberProfileId: petra.id, leaseId: L4.id,
    periodStart: prevMonth[0], periodEnd: prevMonth[1], dueDate: prevMonth[0],
    items: [rentItem(25000), svcItem("WiFi", 1500), svcItem("Parking", 3000), utilItem("Electricity — A2-02 (100.0 kWh)", 3500), utilItem("Water — A2-02 (32.0 m³)", 800)]
  });
  const lp3 = await payPrev(petraPrev, petra.id, "qr");
  collectedAugBlr += lp3.paidMinor;

  // Meng's previous-month invoice IS the room-move adjustment invoice.
  const mengAdj = await issueInvoice({
    propertyCode: "BLR", propertyId: blr.id, memberProfileId: meng.id, leaseId: L5.id,
    periodStart: prevMonth[0], periodEnd: prevMonth[1], dueDate: prevMonth[0],
    notes: "Room move G0-02 → A2-01: prorated new rent + move fee",
    items: [rentItem(25000), { kind: "one_time", name: "Room move fee (A2-01)", unitMinor: 2000 }]
  });
  const move = await db.roomMove.create({
    data: {
      code: "MOV-2026-0001", memberProfileId: meng.id, fromLeaseId: oldMeng.id, toRoomId: rA201.id,
      effectiveAt: prevMonth[0], status: "executed", requestedByRole: "member", requestedById: null,
      approvedById: pm.id, approvedAt: new Date(prevMonth[0].getTime() - 3 * DAY),
      executedById: pm.id, executedAt: prevMonth[0],
      newLeaseId: L5.id, adjustmentInvoiceId: mengAdj.id,
      oldRentMinor: 18000, newRentMinor: 25000, rentCreditMinor: 0, newRentChargeMinor: 25000,
      moveFeeMinor: 2000, netMinor: 27000, depositDeltaMinor: 7000,
      note: "Meng upgraded from a ground-floor standard to a deluxe room on Floor 2."
    }
  });
  // The adjustment invoice is referenced from the move row (`adjustmentInvoiceId`) above.
  const lp4 = await payPrev(mengAdj, meng.id);
  collectedAugBlr += lp4.paidMinor;

  const isabellaPrev = await issueInvoice({
    propertyCode: "BLR", propertyId: blr.id, memberProfileId: isabella.id, leaseId: L6.id,
    periodStart: prevMonth[0], periodEnd: prevMonth[1], dueDate: prevMonth[0],
    items: [rentItem(32000)]
  });
  const lp5 = await payPrev(isabellaPrev, isabella.id);
  collectedAugBlr += lp5.paidMinor;

  const rithPrev = await issueInvoice({
    propertyCode: "BLR", propertyId: blr.id, memberProfileId: rith.id, leaseId: L7.id,
    periodStart: prevMonth[0], periodEnd: prevMonth[1], dueDate: prevMonth[0],
    items: [rentItem(32000)]
  });
  const lp6 = await payPrev(rithPrev, rith.id);
  collectedAugBlr += lp6.paidMinor;

  const hanaPrev = await issueInvoice({
    propertyCode: "BLR", propertyId: blr.id, memberProfileId: hana.id, leaseId: L8.id,
    periodStart: prevMonth[0], periodEnd: prevMonth[1], dueDate: prevMonth[0],
    items: [rentItem(25000)]
  });
  const lp7 = await payPrev(hanaPrev, hana.id);
  collectedAugBlr += lp7.paidMinor;

  const nunPrev = await issueInvoice({
    propertyCode: "RV", propertyId: rv.id, memberProfileId: nun.id, leaseId: L9.id,
    periodStart: prevMonth[0], periodEnd: prevMonth[1], dueDate: prevMonth[0],
    items: [rentItem(45000)]
  });
  const lp8 = await payPrev(nunPrev, nun.id);

  // ── current month (varied financial states) ──
  // Ling & Sokha & Nun: generous early payers — current month already settled.
  const lingCur = await issueInvoice({
    propertyCode: "BLR", propertyId: blr.id, memberProfileId: ling.id, leaseId: lse1,
    periodStart: curMonth[0], periodEnd: curMonth[1], dueDate: curMonth[0],
    items: [rentItem(25000), svcItem("WiFi", 1500)]
  });
  const cp1 = await payInvoice({ invoice: lingCur, memberProfileId: ling.id, method: "qr", receivedAt: new Date(curMonth[0].getTime() + 2 * DAY) });
  collectedAugBlr += cp1.paidMinor; // not strictly Aug — fine, tracked nominally

  const sokhaCur = await issueInvoice({
    propertyCode: "BLR", propertyId: blr.id, memberProfileId: sokha.id, leaseId: L3.id,
    periodStart: curMonth[0], periodEnd: curMonth[1], dueDate: curMonth[0],
    items: [rentItem(25000), svcItem("WiFi", 1500), svcItem("Parking", 3000)]
  });
  const cp2 = await payInvoice({ invoice: sokhaCur, memberProfileId: sokha.id, method: "bank_transfer", receivedAt: new Date(curMonth[0].getTime() + 2 * DAY) });
  collectedAugBlr += cp2.paidMinor;

  const nunCur = await issueInvoice({
    propertyCode: "RV", propertyId: rv.id, memberProfileId: nun.id, leaseId: L9.id,
    periodStart: curMonth[0], periodEnd: curMonth[1], dueDate: curMonth[0],
    items: [rentItem(45000)]
  });
  await payInvoice({ invoice: nunCur, memberProfileId: nun.id, method: "bank_transfer", receivedAt: new Date(curMonth[0].getTime() + 2 * DAY) });

  // Petra: credit note (billing correction) applied to the current invoice.
  const petraCur = await issueInvoice({
    propertyCode: "BLR", propertyId: blr.id, memberProfileId: petra.id, leaseId: L4.id,
    periodStart: curMonth[0], periodEnd: curMonth[1], dueDate: curMonth[0],
    items: [rentItem(25000), svcItem("WiFi", 1500), svcItem("Parking", 3000)]
  });
  await db.invoice.update({ where: { id: petraCur.id }, data: { amountCreditedMinor: 2000, amountDueMinor: petraCur.totalMinor - 2000 } });
  await db.creditNote.create({
    data: { code: "CN-0001", invoiceId: petraCur.id, amountMinor: 2000, reason: "Billing correction — double-charged parking fee in error. 20.00 applied as credit.", issuedAt: new Date(curMonth[0].getTime() + 3 * DAY), createdById: accountant.id }
  });
  await postTransaction(db, {
    memo: `Credit note CN-0001 on ${petraCur.code}: parking fee correction`,
    refType: "credit_note", refId: petraCur.id, propertyId: blr.id, memberId: petra.id, actorId: accountant.id,
    lines: creditNoteLines([{ code: ACC.SERVICE_REVENUE, credit: 29500 }], 2000)
  });

  // Meng: partial payment → partial_paid, 100.00 still due.
  const mengCur = await issueInvoice({
    propertyCode: "BLR", propertyId: blr.id, memberProfileId: meng.id, leaseId: L5.id,
    periodStart: curMonth[0], periodEnd: curMonth[1], dueDate: curMonth[0],
    items: [rentItem(25000)]
  });
  await payInvoice({ invoice: mengCur, memberProfileId: meng.id, method: "cash", amountMinor: 15000, receivedAt: new Date(curMonth[0].getTime() + 4 * DAY) });

  // Isabella: overdue, late fee applied, dunning stage 1 (mirrors the app's
// M06 applyLateFee flow: add the fee line + post + recompute amounts).
  const isabellaCur = await issueInvoice({
    propertyCode: "BLR", propertyId: blr.id, memberProfileId: isabella.id, leaseId: L6.id,
    periodStart: curMonth[0], periodEnd: curMonth[1], dueDate: new Date(curMonth[0].getTime() - 3 * DAY),
    items: [rentItem(32000)],
    status: "overdue", dunningStage: 1,
    notes: "Invoice overdue — reminder 1 of 3 (dunning +3/+7/+14 days)"
  });
  await db.invoiceItem.create({
    data: { invoiceId: isabellaCur.id, kind: "late_fee", name: "Late fee — payment 3 days past due", qty: 1, unitMinor: 500, amountMinor: 500 }
  });
  await postTransaction(db, {
    memo: `Late fee on ${isabellaCur.code}: $5 flat after 3-day grace`,
    refType: "late_fee", refId: isabellaCur.id, propertyId: blr.id, memberId: isabella.id, actorId: null,
    lines: lateFeeLines(500, isabellaCur.code)
  });
  await db.invoice.update({
    where: { id: isabellaCur.id },
    data: { subtotalMinor: 32500, totalMinor: 32500, amountDueMinor: 32500 }
  });

  // Rith: current month issued; unpaid (moving out — settled via deposit at check-out).
  await issueInvoice({
    propertyCode: "BLR", propertyId: blr.id, memberProfileId: rith.id, leaseId: L7.id,
    periodStart: curMonth[0], periodEnd: curMonth[1], dueDate: curMonth[0],
    items: [rentItem(32000)]
  });

  // ═══════════════════════════ M11 UTILITIES ═══════════════════════════
  const meterCount = await db.meter.count();
  const extraMeters = meterCount === 0;
  void extraMeters;
  const mkMeters = async (roomId: string, prefix: string) => {
    await db.meter.create({ data: { code: `ELEC-${prefix}`, type: "elec", roomId, unitLabel: "kWh" } });
    await db.meter.create({ data: { code: `WATER-${prefix}`, type: "water", roomId, unitLabel: "m³" } });
  };
  if (meterCount <= 4) {
    await mkMeters(rA103.id, "A1-03");
    await mkMeters(rA202.id, "A2-02");
    await mkMeters(rA302.id, "A3-02");
  }
  const elecTariff = await db.tariff.findFirstOrThrow({ where: { utilityType: "elec" } });
  const waterTariff = await db.tariff.findFirstOrThrow({ where: { utilityType: "water" } });

  const addReading = async (meterId: string, readAt: Date, valueMilli: number, tariff: any, leaseId: string, roomId: string, periodStart: Date, periodEnd: Date, opts: { invoiceId?: string; invoiceItemId?: string; anomaly?: boolean } = {}) => {
    const reading = await db.meterReading.create({ data: { meterId, valueMilli, readAt, source: "manual", note: "Demo reading" } });
    const consumptionMilli = valueMilli - ((await db.meterReading.findFirst({ where: { meterId, readAt: { lt: readAt } }, orderBy: { readAt: "desc" } }))?.valueMilli ?? 0);
    const amountMinor = Math.round((consumptionMilli / 1000) * tariff.unitRateMinor);
    return db.utilityCharge.create({
      data: {
        leaseId, roomId, meterId, readingId: reading.id,
        periodStart, periodEnd, consumptionMilli, amountMinor, tariffName: tariff.name,
        status: opts.invoiceId ? "billed" : "pending",
        invoiceId: opts.invoiceId ?? null, invoiceItemId: opts.invoiceItemId ?? null,
        anomaly: opts.anomaly ?? false, note: opts.anomaly ? "Usage 2.4× above recent average — flagged" : null
      }
    });
  };

  // Petra: billed previous-month readings live on petraPrev; current readings pending.
  // Consumption values chosen so the computed charge matches the billed invoice
  // line amounts exactly: 100 kWh × $0.35 = 3500 minor, 32 m³ × $0.25 = 800 minor.
  const petraElec = await db.meter.findFirstOrThrow({ where: { code: "ELEC-A2-02" } });
  const petraWater = await db.meter.findFirstOrThrow({ where: { code: "WATER-A2-02" } });
  const pe1 = await addReading(petraElec.id, new Date(prevMonth[1].getTime() - 4 * DAY), 100000, elecTariff, L4.id, rA202.id, prevMonth[0], prevMonth[1]);
  const pw1 = await addReading(petraWater.id, new Date(prevMonth[1].getTime() - 4 * DAY), 32000, waterTariff, L4.id, rA202.id, prevMonth[0], prevMonth[1]);
  // attach to the billed prev invoice items (matched by amount):
  const petraUtilItems = await db.invoiceItem.findMany({ where: { invoiceId: petraPrev.id, kind: "utility" } });
  for (const charge of [pe1, pw1]) {
    const item = petraUtilItems.find((i) => i.amountMinor === charge.amountMinor);
    if (item) await db.utilityCharge.update({ where: { id: charge.id }, data: { status: "billed", invoiceId: petraPrev.id, invoiceItemId: item.id } });
  }
  await addReading(petraElec.id, new Date(curMonth[0].getTime() + 2 * DAY), 118400, elecTariff, L4.id, rA202.id, curMonth[0], curMonth[1]);
  await addReading(petraWater.id, new Date(curMonth[0].getTime() + 2 * DAY), 56700, waterTariff, L4.id, rA202.id, curMonth[0], curMonth[1]);

  // Sokha: pending electricity spike (anomaly) → rides the NEXT generated invoice.
  const sokhaElec = await db.meter.findFirstOrThrow({ where: { code: "ELEC-A1-03" } });
  await addReading(sokhaElec.id, new Date(curMonth[0].getTime() + 3 * DAY), 112400, elecTariff, L3.id, rA103.id, curMonth[0], curMonth[1], { anomaly: true });
  // Isabella: pending water usage.
  const isaWater = await db.meter.findFirstOrThrow({ where: { code: "WATER-A3-02" } });
  await addReading(isaWater.id, new Date(curMonth[0].getTime() + 1 * DAY), 99000, waterTariff, L6.id, rA302.id, curMonth[0], curMonth[1]);

  // ═══════════════════════════ M12 SERVICES ═══════════════════════════
  const assignService = async (serviceId: string, leaseId: string, startDate: Date, parkingSlotId?: string, wifiAccountId?: string) => {
    const snapshot = await db.leaseService.create({
      data: { leaseId, name: serviceId === wifi.id ? "WiFi" : "Parking", amountMinor: serviceId === wifi.id ? 1500 : 3000, pricingModel: "fixed_monthly", activeFrom: startDate }
    });
    return db.serviceAssignment.create({
      data: {
        serviceId, leaseId, status: "active", startDate,
        parkingSlotId: parkingSlotId ?? null, wifiAccountId: wifiAccountId ?? null,
        snapshotId: snapshot.id, note: "Seeded demo assignment"
      }
    });
  };
  const pA01 = await db.parkingSlot.findFirstOrThrow({ where: { code: "P-A01" } });
  const pA02 = await db.parkingSlot.findFirstOrThrow({ where: { code: "P-A02" } });
  const w101 = await db.wifiAccount.findFirstOrThrow({ where: { ssid: "demo-wifi-101" } });
  const w102 = await db.wifiAccount.findFirstOrThrow({ where: { ssid: "demo-wifi-102" } });
  await assignService(wifi.id, L3.id, monthN(-1), undefined, w101.id);
  await assignService(park.id, L3.id, monthN(-1), pA01.id);
  await assignService(wifi.id, L4.id, monthN(-1), undefined, w102.id);
  await assignService(park.id, L4.id, monthN(-1), pA02.id);
  await db.parkingSlot.update({ where: { id: pA01.id }, data: { status: "assigned" } });
  await db.parkingSlot.update({ where: { id: pA02.id }, data: { status: "assigned" } });
  await db.wifiAccount.update({ where: { id: w101.id }, data: { status: "assigned" } });
  await db.wifiAccount.update({ where: { id: w102.id }, data: { status: "assigned" } });

  // Sokha: laundry per-use pending → one-time line on next invoice (2.5 kg @ 2.00).
  await db.serviceUsage.create({
    data: { serviceId: laundry.id, leaseId: L3.id, qtyMilli: 2500, unitLabel: "kg", unitPriceMinor: 200, usedAt: new Date(curMonth[0].getTime() + 4 * DAY), status: "pending", note: "Washer load 2.5kg" }
  });

  // ══════════════════════ M16 ROOM MOVE (already linked above) ══════════════════════
  await db.roomMove.update({ where: { id: move.id }, data: { adjustmentInvoiceId: mengAdj.id } });

  // ═══════════════════════ M18/M19/M22 FACILITIES ═══════════════════════
  const inspTemplate = async (roomType: string) => db.inspectionTemplate.findFirstOrThrow({ where: { roomType } });
  const completeInspection = async (opts: {
    code: string; type: string; leaseId: string; roomId: string; propertyId: string; template: any;
    scheduledAt?: Date; completedAt: Date; inspectorId: string; failures: Array<{ section: string; item: string; severity: string; note: string }>;
    summaryNote: string; depositDeduction?: { minor: number; status: string };
  }) => {
    const sections = opts.template.sections as Array<{ title: string; items: string[] }>;
    const items = sections.map((s) => ({
      section: s.title,
      items: s.items.map((it) => {
        const f = opts.failures.find((x) => x.section === s.title && x.item === it);
        const res = f ? "fail" : "pass";
        return { item: it, result: res, severity: f?.severity ?? null, note: f?.note ?? null };
      })
    }));
    const total = items.reduce((n, s) => n + s.items.length, 0);
    const pass = items.reduce((n, s) => n + s.items.filter((i: any) => i.result === "pass").length, 0);
    const insp = await db.inspection.create({
      data: {
        code: opts.code, type: opts.type, status: "completed", leaseId: opts.leaseId, roomId: opts.roomId,
        propertyId: opts.propertyId, templateId: opts.template.id, scheduledAt: opts.scheduledAt ?? opts.completedAt,
        completedAt: opts.completedAt, inspectorById: opts.inspectorId, items, overallScore: Math.round((pass / total) * 100), summaryNote: opts.summaryNote
      }
    });
    for (const f of opts.failures) {
      await db.inspectionFinding.create({
        data: {
          inspectionId: insp.id, itemLabel: f.item, severity: f.severity, note: f.note,
          ...(opts.depositDeduction && f.severity === "critical" ? { deductionMinor: opts.depositDeduction.minor, deductionStatus: opts.depositDeduction.status } : { deductionMinor: null, deductionStatus: null })
        }
      });
    }
    return insp;
  };

  const tplDeluxe = await inspTemplate("DELUXE");
  await completeInspection({
    code: "INSP-2026-0001", type: "move_in", leaseId: L3.id, roomId: rA103.id, propertyId: blr.id, template: tplDeluxe,
    completedAt: new Date(monthN(-2).getTime() + 1 * DAY), inspectorId: staff.id, failures: [],
    summaryNote: "Move-in inspection — Sokha Preap, Room A1-03. All items passed."
  });
  await completeInspection({
    code: "INSP-2026-0002", type: "move_out", leaseId: L8.id, roomId: rA104.id, propertyId: blr.id, template: tplDeluxe,
    completedAt: new Date(monthN(-1).getTime() - 2 * DAY), inspectorId: pm.id,
    failures: [
      { section: "Furniture & floor", item: "Curtains/blinds intact", severity: "critical", note: "Curtain rail torn off the wall in front of the window — repair estimate 150.00." },
      { section: "Walls & ceiling", item: "Walls clean, no holes", severity: "minor", note: "Scuff marks rear wall beside the desk." }
    ],
    summaryNote: "Move-out inspection — Hana Takahashi, Room A1-04. Damage deduction proposed for curtain rail.",
    depositDeduction: { minor: 15000, status: "approved" }
  });
  const insp2 = await db.inspection.findFirstOrThrow({ where: { code: "INSP-2026-0002" } });
  await db.lease.update({ where: { id: L8.id }, data: { moveOutInspectionId: insp2.id } });

  await completeInspection({
    code: "INSP-2026-0003", type: "periodic", leaseId: L4.id, roomId: rA202.id, propertyId: blr.id, template: tplDeluxe,
    completedAt: new Date(monthN(-1).getTime() + 10 * DAY), inspectorId: staff.id, failures: [],
    summaryNote: "Periodic 6-month check — Petra Novak, Room A2-02. All systems OK."
  });
  // Rith's upcoming move-out inspection (scheduled, draft).
  const tplStudio = await inspTemplate("STUDIO");
  await db.inspection.create({
    data: {
      code: "INSP-2026-0004", type: "move_out", status: "draft", leaseId: L7.id, roomId: rA301.id,
      propertyId: blr.id, templateId: tplStudio.id, scheduledAt: new Date(monthN(1).getTime() - 5 * DAY),
      inspectorById: staff.id, items: Prisma.DbNull, overallScore: null, summaryNote: "Move-out inspection scheduled for Rith Somnang (notice ends this month)."
    }
  });

  // Maintenance tickets
  const slaDue = (daysFromNow: number) => new Date(Date.now() + daysFromNow * DAY);
  const tk = async (opts: {
    code: string; category: string; priority: string; status: string; title: string; description: string;
    roomId?: string | null; leaseId?: string; memberProfileId?: string;
    slaDueAt?: Date; slaBreachedAt?: Date; assignedToId?: string; resolvedAt?: Date; resolutionNote?: string;
    verifiedAt?: Date; closedAt?: Date; costs?: Array<{ kind: "labor" | "material"; label: string; amountMinor: number; stockItemId?: string; chargeTo?: string }>;
  }) => {
    const t = await db.maintenanceTicket.create({
      data: {
        code: opts.code, propertyId: blr.id, roomId: opts.roomId ?? null, leaseId: opts.leaseId ?? null,
        memberProfileId: opts.memberProfileId ?? null, category: opts.category, priority: opts.priority, status: opts.status,
        title: opts.title, description: opts.description, source: "staff", reportedById: staff.id,
        slaDueAt: opts.slaDueAt ?? slaDue(7), slaBreachedAt: opts.slaBreachedAt ?? null,
        assignedToId: opts.assignedToId ?? null, resolvedAt: opts.resolvedAt ?? null, resolutionNote: opts.resolutionNote ?? null,
        verifiedAt: opts.verifiedAt ?? null, closedAt: opts.closedAt ?? null
      }
    });
    for (const c of opts.costs ?? []) {
      await db.maintenanceCost.create({ data: { ticketId: t.id, ...c, chargeTo: c.chargeTo ?? "owner", createdById: staff.id } });
    }
    return t;
  };
  await tk({ code: "TK-2026-0001", category: "plumbing", priority: "high", status: "open", title: "Leaking pipe behind washbasin", description: "Water stains appearing under A2-04 washbasin. Needs urgent drywall check.", roomId: rA204.id, slaDueAt: slaDue(-1), slaBreachedAt: new Date() });
  await tk({ code: "TK-2026-0002", category: "electrical", priority: "high", status: "in_progress", title: "Socket sparks — A1-04", description: "Power outlet sparks when phone charger is plugged in. Circuit isolated.", roomId: rA104.id, assignedToId: staff.id, slaDueAt: slaDue(2), costs: [{ kind: "labor", label: "Electrician labour (2h)", amountMinor: 15000, chargeTo: "owner" }, { kind: "material", label: "Replacement socket + wiring", amountMinor: 12000, chargeTo: "owner" }] });
  await tk({ code: "TK-2026-0003", category: "furniture", priority: "low", status: "verified", title: "Wobbly table — common kitchen", description: "Kitchen table leg loose; re-glued and re-fixed.", roomId: rG03.id, resolvedAt: new Date(Date.now() - 2 * DAY), resolutionNote: "Re-glued leg joint and clamped overnight.", verifiedAt: new Date(Date.now() - 1 * DAY), costs: [{ kind: "labor", label: "Carpentry (30m)", amountMinor: 8000, chargeTo: "expense" }] });
  await tk({ code: "TK-2026-0004", category: "internet", priority: "medium", status: "closed", title: "WiFi drops in building B courtyard", description: "Intermittent signal — reset access point.", roomId: null, resolvedAt: new Date(Date.now() - 4 * DAY), resolutionNote: "Access point rebooted; QoS rule applied.", verifiedAt: new Date(Date.now() - 3 * DAY), closedAt: new Date(Date.now() - 3 * DAY) });
  const tk5 = await tk({ code: "TK-2026-0005", category: "other", priority: "medium", status: "assigned", title: "Broken hallway light", description: "3rd-floor corridor light flickering — converted from complaint CMP-2026-0004.", roomId: rA304.id, assignedToId: staff.id, slaDueAt: slaDue(3) });

  // Complaints
  const cmp = async (opts: {
    code: string; memberId: string; leaseId: string; category: string; priority: string; status: string;
    subject: string; description: string; slaDueAt?: Date; assignedToId?: string; resolvedAt?: Date;
    resolutionNote?: string; rating?: number; ratingNote?: string; closedAt?: Date;
  }) => {
    const c = await db.complaint.create({
      data: {
        code: opts.code, propertyId: blr.id, memberProfileId: opts.memberId, leaseId: opts.leaseId,
        category: opts.category, priority: opts.priority, source: "portal", status: opts.status,
        subject: opts.subject, description: opts.description, slaDueAt: opts.slaDueAt ?? slaDue(5),
        assignedToId: opts.assignedToId ?? null, resolvedAt: opts.resolvedAt ?? null, resolutionNote: opts.resolutionNote ?? null,
        rating: opts.rating ?? null, ratingNote: opts.ratingNote ?? null, closedAt: opts.closedAt ?? null
      }
    });
    return c;
  };
  const c1 = await cmp({ code: "CMP-2026-0001", memberId: ling.id, leaseId: lse1, category: "noise", priority: "high", status: "in_progress", subject: "Late-night noise from A2-03", description: "Loud music after 11pm for the last three nights. Asked twice in person, still happening.", assignedToId: pm.id, slaDueAt: slaDue(1) });
  await db.complaintComment.create({ data: { complaintId: c1.id, authorById: pm.id, byMember: false, body: "Posted a courtesy reminder notice on Floor 2; will follow up with the neighbour tomorrow." } });
  await db.complaintComment.create({ data: { complaintId: c1.id, authorById: null, byMember: true, body: "Quieter last night — thank you. Will close if it stays this way." } });
  const c2 = await cmp({ code: "CMP-2026-0002", memberId: petra.id, leaseId: L4.id, category: "cleanliness", priority: "low", status: "closed", subject: "Stairwell carpet stained", description: "Coffee spill near Floor 2 stairs, cleaned but still stained.", resolvedAt: new Date(Date.now() - 5 * DAY), resolutionNote: "Deep-cleaned with extraction machine.", rating: 4, ratingNote: "Handled within a day, good job.", closedAt: new Date(Date.now() - 4 * DAY) });
  await db.complaintComment.create({ data: { complaintId: c2.id, authorById: null, byMember: true, body: "Great — resolved." } });
  await cmp({ code: "CMP-2026-0003", memberId: isabella.id, leaseId: L6.id, category: "billing", priority: "high", status: "new", subject: "Extra charge on this month's invoice", description: "I see a 5.00 late fee on the invoice but I always paid on time — please review.", assignedToId: accountant.id, slaDueAt: slaDue(4) });
  await cmp({ code: "CMP-2026-0004", memberId: sokha.id, leaseId: L3.id, category: "facility", priority: "medium", status: "acknowledged", subject: "Flickering corridor light — Floor 3", description: "The light outside A3-04 flickers at night.", assignedToId: staff.id });
  await db.complaint.update({ where: { id: (await db.complaint.findFirstOrThrow({ where: { code: "CMP-2026-0004" } })).id }, data: { ticketId: tk5.id } });

  // ═══════════════════════ M14/M15/M29 POS + STOCK + POs ═══════════════════════
  const stockItem = (name: string) => db.stockItem.findFirstOrThrow({ where: { name, propertyId: blr.id } });
  const cola = await stockItem("Coca-Cola can 330ml");
  const water = await stockItem("Drinking water 1.5L");
  const noodles = await stockItem("Instant noodles pack");
  const detergent = await stockItem("Laundry detergent 1kg");
  const coffee = await stockItem("Coffee beans");
  const angkor = await db.supplier.findFirstOrThrow({ where: { name: "Angkor Wholesale" } });
  const mekong = await db.supplier.findFirstOrThrow({ where: { name: "Mekong Supplies" } });

  // PO-0001 placed & received last week → purchase stock movements.
  const po1 = await db.purchaseOrder.create({
    data: {
      code: "PO-2026-0001", propertyId: blr.id, supplierId: angkor.id, supplierName: angkor.name,
      status: "received", note: "Demo restock: beverages + cleaning", placedAt: new Date(Date.now() - 10 * DAY), receivedAt: new Date(Date.now() - 8 * DAY), createdById: staff.id,
      lines: {
        create: [
          { stockItemId: cola.id, qtyMilli: 48_000, unitCostMilli: 100_000, receivedMilli: 48_000 },
          { stockItemId: water.id, qtyMilli: 96_000, unitCostMilli: 60_000, receivedMilli: 96_000 },
          { stockItemId: noodles.id, qtyMilli: 60_000, unitCostMilli: 150_000, receivedMilli: 60_000 },
          { stockItemId: detergent.id, qtyMilli: 12_000, unitCostMilli: 450_000, receivedMilli: 12_000 },
          { stockItemId: coffee.id, qtyMilli: 5_000, unitCostMilli: 1_200_000, receivedMilli: 5_000 }
        ]
      }
    }
  });
  const inflow = async (item: any, qtyMilli: number, unitCostMilli: number) => {
    const qtyAfterMilli = item.qtyMilli + qtyMilli;
    const avgCostAfterMilli = item.qtyMilli === 0 ? unitCostMilli : Math.round((item.qtyMilli * item.avgCostMilli + qtyMilli * unitCostMilli) / qtyAfterMilli);
    const valueMilli = Math.round((qtyMilli / 1000) * (unitCostMilli / 1000) * 1000);
    await db.stockMovement.create({
      data: { stockItemId: item.id, type: "purchase", qtyMilli, qtyAfterMilli, avgCostAfterMilli, valueMilli, unitCostMilli, purchaseOrderId: po1.id, note: "Received PO-2026-0001", createdById: staff.id }
    });
    await db.stockItem.update({ where: { id: item.id }, data: { qtyMilli: qtyAfterMilli, avgCostMilli: avgCostAfterMilli } });
  };
  for (const [item, qty, cost] of [
    [cola, 48_000, 100_000], [water, 96_000, 60_000], [noodles, 60_000, 150_000],
    [detergent, 12_000, 450_000], [coffee, 5_000, 1_200_000]
  ] as const) {
    await inflow(item, qty, cost);
  }

  // PO-0002 draft — M29 pipeline (awaiting placement).
  await db.purchaseOrder.create({
    data: { code: "PO-2026-0002", propertyId: blr.id, supplierId: mekong.id, supplierName: mekong.name, status: "draft", note: "Next-week snacks restock", createdById: staff.id, lines: { create: [{ stockItemId: noodles.id, qtyMilli: 30_000, unitCostMilli: 160_000, receivedMilli: 0 }] } }
  });

  // POS session + sales (cash + qr + room_charge→invoice on Sokha).
  const posProduct = (name: string) => db.posProduct.findFirstOrThrow({ where: { name } });
  const posCola = await posProduct("Coca-Cola can 330ml");
  const posWater = await posProduct("Drinking water 1.5L");
  const posNoodles = await posProduct("Instant noodles pack");
  const posCoffee = await posProduct("Coffee beans");
  const session = await db.posSession.create({
    data: { propertyId: blr.id, status: "open", openingFloatMinor: 0, openedById: staff.id, openedAt: new Date() }
  });
  const posSale = async (opts: { method: string; items: Array<{ productId: string; name: string; qtyMilli: number; unitPriceMinor: number; lineMinor: number; stockItemId?: string }>; memberProfileId?: string; ref?: string }) => {
    const gross = opts.items.reduce((s, i) => s + i.lineMinor, 0);
    const sale = await db.posSale.create({
      data: {
        code: `SAL-2026-000${(await db.posSale.count()) + 1}`,
        sessionId: session.id, propertyId: blr.id, method: opts.method, totalMinor: gross,
        discountMinor: 0, memberProfileId: opts.memberProfileId ?? null, ref: opts.ref ?? null, soldById: staff.id,
        items: { create: opts.items.map((i) => ({ productId: i.productId, name: i.name, qtyMilli: i.qtyMilli, unitPriceMinor: i.unitPriceMinor, lineMinor: i.lineMinor, stockItemId: i.stockItemId ?? null })) }
      },
      include: { items: true }
    });
    // stock drain for linked items
    for (const it of opts.items.filter((i) => i.stockItemId)) {
      const item = await db.stockItem.findUniqueOrThrow({ where: { id: it.stockItemId! } });
      const qtyAfterMilli = item.qtyMilli - it.qtyMilli;
      const valueMilli = -Math.round((it.qtyMilli / 1000) * (item.avgCostMilli / 1000) * 1000);
      await db.stockMovement.create({
        data: { stockItemId: item.id, type: "sale", qtyMilli: -it.qtyMilli, qtyAfterMilli, avgCostAfterMilli: item.avgCostMilli, valueMilli, saleId: sale.id, note: `POS ${sale.code}`, createdById: staff.id }
      });
      await db.stockItem.update({ where: { id: item.id }, data: { qtyMilli: qtyAfterMilli } });
    }
    // ledger & invoice
    if (opts.method === "room_charge") {
      const invoiceCode = `BLR-POS-${sale.code.slice(-8)}`;
      const invoice = await db.invoice.create({
        data: {
          code: invoiceCode, propertyId: blr.id, leaseId: null, memberProfileId: opts.memberProfileId!,
          status: "issued", periodStart: new Date(), periodEnd: new Date(Date.now() + DAY), issuedAt: new Date(), dueDate: new Date(Date.now() + 2 * DAY),
          subtotalMinor: gross, discountMinor: 0, taxMinor: 0, totalMinor: gross, amountDueMinor: gross,
          posSale: { connect: { id: sale.id } }, items: { create: [{ kind: "one_time", name: "POS — canteen purchases (room charge)", qty: 1, unitMinor: gross, amountMinor: gross }] }
        }
      });
      await db.posSale.update({ where: { id: sale.id }, data: { invoiceId: invoice.id } });
      const member = await db.memberProfile.findUniqueOrThrow({ where: { id: opts.memberProfileId! }, include: { party: true } });
      await postTransaction(db, {
        memo: `POS room charge ${sale.code} → ${member.party.name} (invoice ${invoiceCode})`,
        refType: "invoice", refId: invoice.id, propertyId: blr.id, memberId: opts.memberProfileId!, actorId: staff.id,
        lines: [{ code: ACC.RENT_RECEIVABLE, debit: gross, credit: 0 }, { code: ACC.OTHER_REVENUE, debit: 0, credit: gross }]
      });
      await payInvoice({ invoice, memberProfileId: opts.memberProfileId!, method: "qr", receivedAt: new Date() });
    } else {
      await postTransaction(db, {
        memo: `POS sale ${sale.code} (${opts.method})`,
        refType: "payment", refId: sale.id, propertyId: blr.id, memberId: null, actorId: staff.id,
        lines: [{ code: settlementAccountCode(opts.method), debit: gross, credit: 0 }, { code: ACC.OTHER_REVENUE, debit: 0, credit: gross }]
      });
    }
    return sale;
  };
  await posSale({ method: "cash", items: [{ productId: posCola.id, name: posCola.name, qtyMilli: 1000, unitPriceMinor: 100, lineMinor: 100, stockItemId: cola.id }, { productId: posNoodles.id, name: posNoodles.name, qtyMilli: 1000, unitPriceMinor: 150, lineMinor: 150, stockItemId: noodles.id }] });
  await posSale({ method: "qr", ref: "QR-48392018", items: [{ productId: posWater.id, name: posWater.name, qtyMilli: 1000, unitPriceMinor: 60, lineMinor: 60, stockItemId: water.id }, { productId: posCoffee.id, name: posCoffee.name, qtyMilli: 500, unitPriceMinor: 1200, lineMinor: 600, stockItemId: coffee.id }] });
  const rcSale = await posSale({ method: "room_charge", memberProfileId: sokha.id, items: [{ productId: posWater.id, name: posWater.name, qtyMilli: 1000, unitPriceMinor: 60, lineMinor: 60, stockItemId: water.id }, { productId: posNoodles.id, name: posNoodles.name, qtyMilli: 2000, unitPriceMinor: 150, lineMinor: 300, stockItemId: noodles.id }] });
  void rcSale;
  // Close the drawer with a small variance demo.
  await db.posSession.update({
    where: { id: session.id },
    data: { status: "closed", expectedCashMinor: 250, countedCashMinor: 240, varianceMinor: -10, closeNote: "10 cent cash shortage — likely miscount; logged for the shift report.", closedById: staff.id, closedAt: new Date() }
  });

  // Stocktake: count variance → adjustment movements.
  const stk = await db.stocktake.create({
    data: { code: "STK-2026-0001", propertyId: blr.id, status: "completed", note: "Monthly count — two items short vs book", createdById: staff.id }
  });
  const stockLine = async (item: any, countedMilli: number) => {
    const varianceMilli = countedMilli - item.qtyMilli;
    await db.stocktakeLine.create({ data: { stocktakeId: stk.id, stockItemId: item.id, expectedMilli: item.qtyMilli, countedMilli, varianceMilli } });
    if (varianceMilli !== 0) {
      const after = item.qtyMilli + varianceMilli;
      const valueMilli = Math.round((varianceMilli / 1000) * (item.avgCostMilli / 1000) * 1000);
      await db.stockMovement.create({
        data: { stockItemId: item.id, type: "adjustment", qtyMilli: varianceMilli, qtyAfterMilli: after, avgCostAfterMilli: item.avgCostMilli, valueMilli, stocktakeId: stk.id, note: "Stocktake variance", createdById: staff.id }
      });
      await db.stockItem.update({ where: { id: item.id }, data: { qtyMilli: after } });
    }
  };
  const colaAfter = await db.stockItem.findUniqueOrThrow({ where: { id: cola.id } });
  const noodlesAfter = await db.stockItem.findUniqueOrThrow({ where: { id: noodles.id } });
  await stockLine(colaAfter, colaAfter.qtyMilli - 1000);
  await stockLine(noodlesAfter, noodlesAfter.qtyMilli - 2000);
  await db.stocktake.update({ where: { id: stk.id }, data: { valueDeltaMilli: await db.stockMovement.aggregate({ where: { stocktakeId: stk.id }, _sum: { valueMilli: true } }).then((a) => a._sum.valueMilli ?? 0) } });

  // ═══════════════════════════ M20 EXPENSES & P&L ═══════════════════════════
  const expense = async (opts: {
    code: string; category: string; vendorName: string; description: string; expenseDate: Date; amountMinor: number;
    paidVia: "cash" | "bank_transfer"; status: string; autoApproved?: boolean; approvedById?: string; approvedAt?: Date;
    rejectReason?: string;
  }) => {
    const category = await db.expenseCategory.findFirstOrThrow({ where: { propertyId: blr.id, name: opts.category } });
    const exp = await db.expense.create({
      data: {
        code: opts.code, propertyId: blr.id, categoryId: category.id, vendorName: opts.vendorName,
        description: opts.description, expenseDate: opts.expenseDate, amountMinor: opts.amountMinor,
        paidVia: opts.paidVia, status: opts.status, autoApproved: opts.autoApproved ?? false,
        submittedById: staff.id, approvedById: opts.approvedById ?? null, approvedAt: opts.approvedAt ?? null,
        rejectReason: opts.rejectReason ?? null
      }
    });
    if (opts.status === "approved") {
      const memo = `Expense ${opts.code} (${opts.vendorName}) — ${opts.description}`;
      const ledgerTxId = await postTransaction(db, {
        memo, refType: "expense", refId: exp.id, propertyId: blr.id, memberId: null, actorId: opts.approvedById ?? null,
        lines: [
          { code: category.accountCode === "5100" ? ACC.BANK_FEES : ACC.OPERATING_EXPENSES, debit: opts.amountMinor, credit: 0 },
          { code: opts.paidVia === "cash" ? ACC.CASH : ACC.BANK, debit: 0, credit: opts.amountMinor }
        ]
      });
      await db.expense.update({ where: { id: exp.id }, data: { ledgerTxId } });
    }
    return exp;
  };
  await expense({ code: "EXP-2026-0001", category: "Property utilities", vendorName: "Electricity Authority", description: "August common-area electricity bill", expenseDate: new Date(monthN(-1).getTime() + 6 * DAY), amountMinor: 55000, paidVia: "cash", status: "approved", autoApproved: false, approvedById: accountant.id, approvedAt: new Date(monthN(-1).getTime() + 7 * DAY) });
  await expense({ code: "EXP-2026-0002", category: "Internet & WiFi", vendorName: "Orange Fibre", description: "August fibre subscription (passthrough to owner — see STM-2026-0001)", expenseDate: new Date(monthN(-1).getTime() + 5 * DAY), amountMinor: 22000, paidVia: "bank_transfer", status: "approved", autoApproved: true, approvedById: accountant.id, approvedAt: new Date(monthN(-1).getTime() + 6 * DAY) });
  await expense({ code: "EXP-2026-0003", category: "Repairs & maintenance", vendorName: "Khmer Plumbing Services", description: "A2 hallway pipe repair + materials", expenseDate: new Date(monthN(-1).getTime() + 9 * DAY), amountMinor: 40000, paidVia: "bank_transfer", status: "approved", autoApproved: true, approvedById: accountant.id, approvedAt: new Date(monthN(-1).getTime() + 10 * DAY) });
  await expense({ code: "EXP-2026-0004", category: "Repairs & maintenance", vendorName: "Cool Tech HVAC", description: "A/C compressor quote — replacement recommended", expenseDate: new Date(), amountMinor: 120000, paidVia: "bank_transfer", status: "pending", autoApproved: false });
  await expense({ code: "EXP-2026-0005", category: "Property utilities", vendorName: "Tech Shop", description: "New desk phones (office refurb)", expenseDate: new Date(Date.now() - 6 * DAY), amountMinor: 90000, paidVia: "bank_transfer", status: "rejected", autoApproved: false, approvedById: accountant.id, rejectReason: "Hardware upgrade deferred to next quarter" });

  // ═══════════════════════════ M24 OWNER STATEMENTS ═══════════════════════════
  const lim = await db.ownerProfile.findFirstOrThrow({ where: { party: { email: "owner@demo.test" } } });
  const chaya = await db.ownerProfile.findFirstOrThrow({ where: { party: { email: "owner2@demo.test" } } });
  const owc1 = await db.ownerContract.findFirstOrThrow({ where: { code: "OWC-0001" } });
  const owc2 = await db.ownerContract.findFirstOrThrow({ where: { code: "OWC-0002" } });

  const stm1 = await db.ownerStatement.create({
    data: {
      code: "STM-2026-0001", ownerProfileId: lim.id, contractId: owc1.id, buildingId: bldgA.id, propertyId: blr.id,
      month: lastMonthLabel, status: "approved",
      collectedMinor: collectedAugBlr, grossShareMinor: Math.round((collectedAugBlr * 60) / 100),
      managementFeeMinor: Math.round((collectedAugBlr * 60 * 10) / 10000),
      passthroughMinor: 22000, ownerMaintenanceMinor: 40000, adjustmentsMinor: 0, netMinor: Math.round((collectedAugBlr * 60) / 100) - Math.round((collectedAugBlr * 60 * 10) / 10000) - 22000 - 40000,
      lineSnapshot: JSON.stringify({ model: "REVENUE_SHARE", sharePercent: 60, managementFeePercent: 10, collectedMinor: collectedAugBlr, passthrough: ["Internet & WiFi 22000"], ownerMaintenance: ["Repairs & maintenance 40000"] }),
      approvedById: accountant.id, approvedAt: new Date(monthN(0).getTime() + 2 * DAY), generatedById: root.id
    }
  });
  await postTransaction(db, {
    memo: `Owner statement ${stm1.code} approved (accrual) — Bassac Lane Building A`,
    refType: "statement_accrual", refId: stm1.id, propertyId: blr.id, memberId: null, actorId: accountant.id,
    lines: [
      { code: ACC.OWNER_DISTRIBUTIONS, debit: stm1.netMinor, credit: 0 },
      { code: ACC.OWNER_PAYABLE, debit: 0, credit: stm1.netMinor }
    ]
  });
  await db.ownerStatement.update({ where: { id: stm1.id }, data: { ledgerTxId: (await db.ledgerTransaction.findFirst({ where: { refType: "statement_accrual", refId: stm1.id } }))!.id } });

  const stm2 = await db.ownerStatement.create({
    data: {
      code: "STM-2026-0002", ownerProfileId: chaya.id, contractId: owc2.id, buildingId: villa.id, propertyId: rv.id,
      month: lastMonthLabel, status: "approved",
      collectedMinor: 45000, grossShareMinor: 65000,
      managementFeeMinor: 0, passthroughMinor: 0, ownerMaintenanceMinor: 0, adjustmentsMinor: 0, netMinor: 65000,
      lineSnapshot: JSON.stringify({ model: "FIXED_RENT", fixedRentMinor: 65000, collectedMinor: 45000 }),
      approvedById: accountant.id, approvedAt: new Date(monthN(0).getTime() + 3 * DAY), generatedById: root.id
    }
  });
  await postTransaction(db, {
    memo: `Owner statement ${stm2.code} approved (accrual) — Riverside Villa`,
    refType: "statement_accrual", refId: stm2.id, propertyId: rv.id, memberId: null, actorId: accountant.id,
    lines: [
      { code: ACC.OWNER_DISTRIBUTIONS, debit: 65000, credit: 0 },
      { code: ACC.OWNER_PAYABLE, debit: 0, credit: 65000 }
    ]
  });
  await db.ownerStatement.update({ where: { id: stm2.id }, data: { ledgerTxId: (await db.ledgerTransaction.findFirst({ where: { refType: "statement_accrual", refId: stm2.id } }))!.id } });

  // ═══════════════════════ M23 ATTENDANCE ═══════════════════════
  const shiftMorning = await db.shift.findFirstOrThrow({ where: { propertyId: blr.id, name: "Morning 08:00–16:00" } });
  const punch = async (user: any, dayOffset: number, clockInMin: number, clockOutMin: number, opts: { minutesWorked?: number; overtimeMinutes?: number; note?: string; late?: boolean } = {}) => {
    const day = new Date(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), new Date().getUTCDate() - dayOffset));
    const clockIn = new Date(day.getTime() + clockInMin * 60_000);
    const clockOut = clockOutMin ? new Date(day.getTime() + clockOutMin * 60_000) : null;
    const minutesWorked = opts.minutesWorked ?? (clockOut ? Math.round((clockOut.getTime() - clockIn.getTime()) / 60_000) : null);
    const record = await db.attendanceRecord.create({
      data: {
        userId: user.id, propertyId: blr.id, shiftId: shiftMorning.id, workDate: day,
        clockInAt: clockIn, clockOutAt: clockOut, inLat: 11.5564, inLng: 104.9282, inGeoStatus: "inside",
        outLat: clockOut ? 11.5564 : null, outLng: clockOut ? 104.9282 : null, outGeoStatus: clockOut ? "inside" : null,
        minutesWorked, overtimeMinutes: opts.overtimeMinutes ?? 0, source: "kiosk", note: opts.note ?? null
      }
    });
    if (opts.late) {
      await db.attendanceException.create({
        data: { recordId: record.id, userId: user.id, propertyId: blr.id, workDate: day, type: "late_clock_in", detail: "Clocked in 12 minutes past shift start (grace 10)", status: "open" }
      });
    }
    return record;
  };
  // Ratana (staff) — a clean week + one late day + one overtime day.
  for (const [off, note] of [[4, null], [3, "Covered evening desk handover"] as [number, string | null], [2, null], [1, null], [0, null]] as Array<[number, string | null]>) {
    await punch(staff, off, 487 + (off === 2 ? 12 : 0), 961, { minutesWorked: off === 2 ? 462 : 474, note: note ?? undefined, late: off === 2 });
  }
  await punch(staff, 5, 480, 1009, { minutesWorked: 529, overtimeMinutes: 45, note: "Covered evening desk handover" });
  await punch(pm, 4, 481, 960, { minutesWorked: 479 });
  await punch(pm, 2, 478, 958, { minutesWorked: 480 });
  await punch(pm, 0, 485, 962, { minutesWorked: 477 });
  // One open exception without a record: PM missed yesterday's clock-out.
  const yesterday = new Date(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), new Date().getUTCDate() - 1));
  await db.attendanceException.create({
    data: { recordId: null, userId: root.id, propertyId: blr.id, workDate: yesterday, type: "missed_clock_out", detail: "No clock-out punch recorded for the day", status: "open" }
  });

  // ═══════════════════════ M21 TELEGRAM ═══════════════════════
  await db.telegramLink.upsert({
    where: { chatId: "987654321" },
    create: { chatId: "987654321", telegramUserId: "200000001", displayName: "@chanling", principalType: "member", memberProfileId: ling.id, prefs: "{\"invoiceIssued\":true,\"paymentReceived\":true,\"overdueReminder\":true}" },
    update: {}
  });
  await db.telegramLink.upsert({
    where: { chatId: "123456789" },
    create: { chatId: "123456789", telegramUserId: "200000002", displayName: "@chaya", principalType: "owner", ownerProfileId: chaya.id, prefs: "{\"statementReady\":true,\"occupancyDigest\":true}" },
    update: {}
  });
  await db.telegramOutbox.createMany({
    data: [
      { chatId: "987654321", template: "invoice_issued", body: "New invoice LSE-0001 · Chan Ling — 26.50 due 1 Oct.", status: "sent" },
      { chatId: "987654321", template: "payment_received", body: "Payment received — receipt RCP-… · Chan Ling — 26.50.", status: "sent" },
      { chatId: "123456789", template: "statement_ready", body: "Owner statement STM-2026-0001 ready for review.", status: "sent" },
      { chatId: "987654321", template: "overdue_reminder", body: "Reminder: 150.00 outstanding on invoice for Room A2-01.", status: "mocked" }
    ]
  });

  // ═══════════════════════ M32 SHORT STAYS ═══════════════════════
  const hourly = await db.rentModule.findUniqueOrThrow({ where: { slug: "hourly" } });
  const overnight = await db.rentModule.findUniqueOrThrow({ where: { slug: "overnight" } });
  const stayGuest = await addMember({
    email: "guest.walkin@example.test", name: "Walk-in Guest (Nara)", phone: "+855 97 111 000", nationality: "Thai",
    idNumber: "TH-556677", occupation: "Traveller", propertyId: blr.id,
    contact: { name: "Walk-in Guest — Nara", relationship: "Other", phone: "+855 97 111 000" }
  });
  const stay1 = await db.stayBooking.create({
    data: {
      code: "STY-2026-0001", moduleId: hourly.id, roomId: rG01.id, propertyId: blr.id, memberProfileId: stayGuest.id,
      guestName: "Walk-in Guest (Nara)", guestPhone: "+855 97 111 000", checkIn: new Date(Date.now() - 1 * DAY), checkOut: new Date(Date.now() - 1 * DAY + 4 * 3600_000),
      guests: 1, status: "checked_out", priceSnapshotMinor: 3800, dayPriceMinor: 8800, depositMinor: 0, posMode: "direct",
      checkedOutAt: new Date(Date.now() - 1 * DAY + 4 * 3600_000), notes: "Hourly stay demo — charged by the 4h bucket."
    }
  });
  const stayTab = await db.invoice.create({
    data: {
      code: `STY-TAB-${stay1.id.slice(-8)}`, propertyId: blr.id, leaseId: null, memberProfileId: stayGuest.id,
      status: "issued", periodStart: stay1.checkIn, periodEnd: stay1.checkOut, issuedAt: stay1.checkIn, dueDate: stay1.checkIn,
      subtotalMinor: 3800, discountMinor: 0, taxMinor: 0, totalMinor: 3800, amountDueMinor: 3800,
      stayBookingId: stay1.id, items: { create: [{ kind: "one_time", name: "Hourly room (4h) — G0-01", qty: 1, unitMinor: 3800, amountMinor: 3800 }] }
    }
  });
  await db.stayBooking.update({ where: { id: stay1.id }, data: { tabInvoiceId: stayTab.id } });
  await payInvoice({ invoice: stayTab, memberProfileId: stayGuest.id, method: "qr", receivedAt: stay1.checkedOutAt! });

  const stay2 = await db.stayBooking.create({
    data: {
      code: "STY-2026-0002", moduleId: overnight.id, roomId: rG02.id, propertyId: blr.id, memberProfileId: stayGuest.id,
      guestName: "Walk-in Guest (Nara)", guestPhone: "+855 97 111 000", checkIn: new Date(), checkOut: new Date(Date.now() + 1440 * 60_000),
      guests: 2, status: "checked_in", priceSnapshotMinor: 12000, dayPriceMinor: 12000, depositMinor: 0, posMode: "tab",
      notes: "Overnight stay — tab open for F&B; settles at checkout."
    }
  });
  const stay2Tab = await db.invoice.create({
    data: {
      code: `STY-TAB-${stay2.id.slice(-8)}`, propertyId: blr.id, leaseId: null, memberProfileId: stayGuest.id,
      status: "issued", periodStart: stay2.checkIn, periodEnd: stay2.checkOut, issuedAt: new Date(), dueDate: stay2.checkOut,
      subtotalMinor: 12000, discountMinor: 0, taxMinor: 0, totalMinor: 12000, amountDueMinor: 12000,
      stayBookingId: stay2.id, items: { create: [{ kind: "one_time", name: "Overnight (24h) — G0-02", qty: 1, unitMinor: 12000, amountMinor: 12000 }] }
    }
  });
  await db.stayBooking.update({ where: { id: stay2.id }, data: { tabInvoiceId: stay2Tab.id } });

  // ═══════════════════════ M25 PORTAL + M33 ALERT EVENTS ═══════════════════════
  await db.announcement.create({ data: { propertyId: blr.id, title: "Weekend rooftop BBQ — Saturday 6pm", body: "Join us on the roof terrace this Saturday. Soft drinks provided, BYO dishes." } });
  await db.domainEvent.createMany({
    data: [
      { type: "invoice.overdue", propertyId: blr.id, payload: JSON.stringify({ invoiceCode: "BLR-2026-0023", member: "Isabella Moreau", dueMinor: 32500 }) },
      { type: "ticket.sla_breached", propertyId: blr.id, payload: JSON.stringify({ ticket: "TK-2026-0001", title: "Leaking pipe behind washbasin", slaHoursOvertime: 26 }) },
      { type: "stock.low", propertyId: blr.id, payload: JSON.stringify({ item: "Laundry detergent 1kg", onHandMilli: 9000, minQtyMilli: 4000 }) },
      { type: "complaint.new", propertyId: blr.id, payload: JSON.stringify({ complaint: "CMP-2026-0003", member: "Isabella Moreau", subject: "Extra charge on this month's invoice" }) },
      { type: "stay.checked_in", propertyId: blr.id, payload: JSON.stringify({ booking: "STY-2026-0002", room: "G0-02", guest: "Nara" }) }
    ]
  });

  // ── finalize: sync number sequences to what we inserted ────────────────────
  const seq = async (key: string, value: number) =>
    db.numberSequence.upsert({ where: { key }, create: { key, value }, update: { value } });
  const countPrefix = async (model: "invoice" | "payment" | "creditNote" | "maintenanceTicket" | "complaint" | "inspection" | "purchaseOrder" | "posSale" | "stocktake" | "stayBooking" | "ownerStatement" | "roomMove" | "lease" | "expense" | "depositTransaction", prefix: string) => (db as any)[model].count({ where: { code: { startsWith: prefix } } }) as Promise<number>;

  await seq("LEASE", await countPrefix("lease", "LSE-"));
  await seq("INV:BLR:2026", await countPrefix("invoice", "BLR-2026-"));
  await seq("INV:RV:2026", await countPrefix("invoice", "RV-2026-"));
  await seq("PMT:2026", await countPrefix("payment", "PMT-2026-"));
  await seq("RCP:2026", await countPrefix("payment", "RCP-2026-"));
  await seq("CREDITNOTE", await countPrefix("creditNote", "CN-"));
  await seq("TK", await countPrefix("maintenanceTicket", "TK-2026-"));
  await seq("CMP", await countPrefix("complaint", "CMP-2026-"));
  await seq("INSP", await countPrefix("inspection", "INSP-2026-"));
  await seq("EXPENSE", await countPrefix("expense", "EXP-2026-"));
  await seq("PO", await countPrefix("purchaseOrder", "PO-2026-"));
  await seq("POSSALE", await countPrefix("posSale", "SAL-2026-"));
  await seq("STOCKTAKE", await countPrefix("stocktake", "STK-2026-"));
  await seq("STAYBOOK", await countPrefix("stayBooking", "STY-2026-"));
  await seq("STATEMENT", await countPrefix("ownerStatement", "STM-2026-"));
  await seq("ROOMMOVE", await countPrefix("roomMove", "MOV-2026-"));

  await db.setting.create({ data: { key: "demo.full", value: JSON.stringify({ version: 1, seededAt: new Date().toISOString() }), updatedBy: "seed" } });
  await db.auditLog.create({
    data: { actorName: "system", module: "M00", action: "seed", entityType: "system", summary: "Full client-demo dataset seeded (SEED_FULL_DEMO)" }
  });

  remarksSummary.push("Full demo dataset applied.");
  console.log("  demo data: full module dataset seeded ✔");
  console.log(`    leases: 9 (6 active · 1 notice · 1 terminated · 1 draft) · 1 executed room move`);
  console.log(`    invoices: ${await countPrefix("invoice", "BLR-2026-") + (await countPrefix("invoice", "RV-2026-")) + (await countPrefix("invoice", "BLR-POS-")) + (await countPrefix("invoice", "STY-TAB-"))} · deposits: 9 (7 held · 1 settled · 1 billed) · payments in PMT/RCP sequence right after seed`);
  console.log(`    story mix: paid-up (Ling, Sokha, Nun) · credit note (Petra) · partial (Meng 60%) · overdue+late fee (Isabella) · move-out (Hana settled, Rith notice)`);
}

export { seedFullDemo, type Numbers };