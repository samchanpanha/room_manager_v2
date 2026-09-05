/// M33 Rent Alerts & Notifications — monthly rent repayment awareness.
/// Distils open rent invoices into upcoming (due within `aheadDays`) and
/// overdue (due date passed) digests, then emits `rent.reminder`/`rent.overdue`
/// domain events once per invoice per cycle. The M21 Telegram dispatcher turns
/// those events into member-chat messages; the dashboard widget and portal card
/// read the same digest directly.
import { prisma } from "@/lib/db";
import { emitDomainEvent } from "@/lib/events";
import { getSettings } from "@/lib/settings";

const DAY = 24 * 60 * 60 * 1000;
const SENT_KEY = "m33.rentAlertSent";

export interface RentDueRow {
  invoiceId: string;
  invoiceCode: string;
  memberId: string;
  memberName: string;
  propertyId: string;
  propertyName: string;
  leaseCode: string | null;
  dueDate: string | null;
  amountDueMinor: number;
  daysUntil: number; // negative = overdue, positive = days to due date
  status: string;
  dunningStage: number;
}

export interface RentDueDigest {
  upcoming: RentDueRow[];
  overdue: RentDueRow[];
  upcomingTotalMinor: number;
  overdueTotalMinor: number;
}

/// Open *rent* invoices only — deposit invoices and non-rent line items
/// (services, utilities, one-time charges) are excluded from the repayment view.
function isRentInvoice(inv: { isDeposit: boolean; items: Array<{ kind: string }> }): boolean {
  if (inv.isDeposit) return false;
  return inv.items.some((i) => i.kind === "rent");
}

/// Central digest used by the dashboard widget, the job and the portal card.
export async function collectRentDues(propertyIds: string[], aheadDays = 7): Promise<RentDueDigest> {
  const now = Date.now();
  const invoices = await prisma.invoice.findMany({
    where: {
      status: { in: ["issued", "partial_paid", "overdue"] },
      amountDueMinor: { gt: 0 },
      propertyId: { in: propertyIds },
      isDeposit: false
    },
    include: {
      member: { include: { party: true, leases: { where: { status: { in: ["active", "notice"] } }, select: { code: true }, take: 1 } } },
      property: true,
      items: { where: { kind: "rent" }, select: { kind: true }, take: 1 }
    }
  });

  const digest: RentDueDigest = { upcoming: [], overdue: [], upcomingTotalMinor: 0, overdueTotalMinor: 0 };
  for (const inv of invoices) {
    if (!isRentInvoice(inv)) continue;
    const due = inv.dueDate?.getTime() ?? now;
    const daysUntil = Math.round((due - now) / DAY);
    if (daysUntil > aheadDays) continue; // too far out — keep the digest focused
    const row: RentDueRow = {
      invoiceId: inv.id,
      invoiceCode: inv.code,
      memberId: inv.memberProfileId,
      memberName: inv.member.party.name,
      propertyId: inv.propertyId,
      propertyName: inv.property.name,
      leaseCode: inv.member.leases[0]?.code ?? null,
      dueDate: inv.dueDate?.toISOString().slice(0, 10) ?? null,
      amountDueMinor: inv.amountDueMinor,
      daysUntil,
      status: inv.status,
      dunningStage: inv.dunningStage
    };
    if (daysUntil < 0) {
      digest.overdue.push(row);
      digest.overdueTotalMinor += row.amountDueMinor;
    } else {
      digest.upcoming.push(row);
      digest.upcomingTotalMinor += row.amountDueMinor;
    }
  }
  digest.upcoming.sort((a, b) => a.daysUntil - b.daysUntil);
  digest.overdue.sort((a, b) => b.daysUntil - a.daysUntil);
  return digest;
}

async function readSent(): Promise<{ reminders: string[]; overdue: string[] }> {
  const row = await prisma.setting.findUnique({ where: { key: SENT_KEY } });
  if (!row) return { reminders: [], overdue: [] };
  try {
    const v = JSON.parse(row.value) as { reminders?: unknown; overdue?: unknown };
    return {
      reminders: Array.isArray(v.reminders) ? (v.reminders as string[]) : [],
      overdue: Array.isArray(v.overdue) ? (v.overdue as string[]) : []
    };
  } catch {
    return { reminders: [], overdue: [] };
  }
}

async function writeSent(sent: { reminders: string[]; overdue: string[] }): Promise<void> {
  await prisma.setting.upsert({
    where: { key: SENT_KEY },
    create: { key: SENT_KEY, value: JSON.stringify(sent), updatedBy: "cron:m33" },
    update: { value: JSON.stringify(sent), updatedBy: "cron:m33" }
  });
}

export interface RentAlertRun {
  reminders: number;
  overdue: number;
  upcomingCount: number;
  overdueCount: number;
  horizonDays: number;
}

/// Cron-shaped job: emit one reminder/overdue event per open rent invoice,
/// deduped against the last run, and prune entries for settled invoices.
export async function runRentAlerts(propertyIds?: string[]): Promise<RentAlertRun> {
  const { rentAlerts } = await getSettings();
  const aheadDays = Math.max(1, rentAlerts.aheadDays);
  const overdueDays = Math.max(0, rentAlerts.overdueDays);

  const scopeIds =
    propertyIds && propertyIds.length > 0
      ? propertyIds
      : (await prisma.property.findMany({ where: { status: "active" }, select: { id: true } })).map((p) => p.id);

  const digest = await collectRentDues(scopeIds, aheadDays);
  const sent = await readSent();

  let reminders = 0;
  let overdue = 0;

  for (const inv of digest.upcoming) {
    if (sent.reminders.includes(inv.invoiceId)) continue;
    await emitDomainEvent("rent.reminder", { invoiceId: inv.invoiceId, daysUntil: inv.daysUntil }, inv.propertyId);
    sent.reminders.push(inv.invoiceId);
    reminders += 1;
  }

  for (const inv of digest.overdue) {
    if (inv.daysUntil > -overdueDays) continue; // grace: only message once the grace window passes
    if (sent.overdue.includes(inv.invoiceId)) continue;
    await emitDomainEvent("rent.overdue", { invoiceId: inv.invoiceId, daysLate: -inv.daysUntil }, inv.propertyId);
    sent.overdue.push(inv.invoiceId);
    overdue += 1;
  }

  // Prune settled invoices (paid / voided / zeroed) so they can re-alert if re-opened.
  const openIds = new Set(
    (
      await prisma.invoice.findMany({
        where: { id: { in: [...sent.reminders, ...sent.overdue] }, amountDueMinor: { gt: 0 }, status: { in: ["issued", "partial_paid", "overdue"] } },
        select: { id: true }
      })
    ).map((i) => i.id)
  );
  const next = {
    reminders: sent.reminders.filter((id) => openIds.has(id)),
    overdue: sent.overdue.filter((id) => openIds.has(id))
  };
  await writeSent(next);

  return { reminders, overdue, upcomingCount: digest.upcoming.length, overdueCount: digest.overdue.length, horizonDays: aheadDays };
}

/// Dashboard widget shape: latest upcoming/overdue rent rows scoped to a user.
export async function rentDuesForScopes(propertyIds: string[], aheadDays = 7): Promise<RentDueDigest> {
  return collectRentDues(propertyIds, aheadDays);
}