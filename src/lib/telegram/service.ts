/// M21 Telegram Bot service (§M21): linking (one-time codes), the signed
/// webhook command router, and the event → template dispatcher (outbox with a
/// DomainEvent cursor, cron-shaped job). Member commands return own data only
/// — everything resolves through the chat's bound principal and reuses the
/// existing module services (createInvoiceQr for /pay, portal queries for
/// /status and /dues).
import { randomBytes, timingSafeEqual } from "node:crypto";
import { prisma } from "@/lib/db";
import { getSettings, getTemplateOverride } from "@/lib/settings";
import { env } from "@/lib/env";
import { logAudit } from "@/lib/audit";
import { createInvoiceQr } from "@/lib/qrpay/service";
import { memberOpenInvoices } from "@/lib/portal";
import { money, sendTelegramMessage } from "./api";

export const LINK_CODE_TTL_MS = 15 * 60 * 1000;
const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no 0/O/1/I

export type PrincipalType = "member" | "owner" | "user";

export const DEFAULT_PREFS = {
  invoiceIssued: true,
  paymentReceived: true,
  overdueReminder: true,
  ticketUpdates: true,
  complaintUpdates: true,
  lowStock: true,
  statementReady: true,
  occupancyDigest: false
} as const;

export type Prefs = Partial<Record<keyof typeof DEFAULT_PREFS, boolean>>;

export function parsePrefs(raw: string | null | undefined): Prefs {
  try {
    return (JSON.parse(raw ?? "{}") ?? {}) as Prefs;
  } catch {
    return {};
  }
}

export function prefEnabled(link: { prefs: string }, key: keyof typeof DEFAULT_PREFS): boolean {
  const p = parsePrefs(link.prefs);
  return p[key] ?? DEFAULT_PREFS[key];
}

export function verifyWebhookSecret(header: string | null | undefined): boolean {
  if (!header) return false;
  const expected = Buffer.from(env.TELEGRAM_WEBHOOK_SECRET);
  const got = Buffer.from(header);
  if (expected.length !== got.length) return false;
  return timingSafeEqual(expected, got);
}

// ── linking ──────────────────────────────────────────────────────────────────

export interface LinkCodeResult {
  code: string;
  expiresAt: Date;
  botUsername: string;
  deepLink: string;
}

/// One-time link code for a member or owner profile (§M21). Supersedes the
/// principal's earlier unconsumed codes.
export async function createLinkCode(principalType: "member" | "owner", principalId: string): Promise<LinkCodeResult> {
  await prisma.telegramLinkCode.updateMany({
    where: { principalType, ...(principalType === "member" ? { memberProfileId: principalId } : { ownerProfileId: principalId }), consumedAt: null },
    data: { consumedAt: new Date() }
  });
  const code = Array.from(randomBytes(8))
    .map((b) => CODE_ALPHABET[b % CODE_ALPHABET.length])
    .join("");
  const expiresAt = new Date(Date.now() + LINK_CODE_TTL_MS);
  await prisma.telegramLinkCode.create({
    data: {
      code,
      principalType,
      ...(principalType === "member" ? { memberProfileId: principalId } : { ownerProfileId: principalId }),
      expiresAt
    }
  });
  const botUsername = env.TELEGRAM_BOT_USERNAME;
  return { code, expiresAt, botUsername, deepLink: `https://t.me/${botUsername}?start=${code}` };
}

async function consumeLinkCode(code: string) {
  const row = await prisma.telegramLinkCode.findUnique({ where: { code } });
  if (!row || row.consumedAt || row.expiresAt < new Date()) return null;
  await prisma.telegramLinkCode.update({ where: { id: row.id }, data: { consumedAt: new Date() } });
  return row;
}

export async function getLinkForPrincipal(principalType: "member" | "owner", principalId: string) {
  return prisma.telegramLink.findFirst({
    where: { principalType, ...(principalType === "member" ? { memberProfileId: principalId } : { ownerProfileId: principalId }), unlinkedAt: null }
  });
}

export async function setPrefs(linkId: string, patch: Prefs): Promise<Prefs> {
  const link = await prisma.telegramLink.findUniqueOrThrow({ where: { id: linkId } });
  const merged = { ...parsePrefs(link.prefs), ...patch };
  await prisma.telegramLink.update({ where: { id: linkId }, data: { prefs: JSON.stringify(merged) } });
  return merged;
}

// ── webhook command router ───────────────────────────────────────────────────

export interface TelegramUpdate {
  message?: {
    message_id: number;
    text?: string;
    chat: { id: number | string };
    from?: { id: number | string; username?: string; first_name?: string };
  };
}

export interface UpdateOutcome {
  status: number; // HTTP status the webhook route replies with
  handled: string; // what the router did (audit/log line)
}

const HELP_TEXT = [
  "🤖 RentManager bot — commands:",
  "/status — your room, lease and balance",
  "/dues — your open invoices",
  "/pay — QR payment for your oldest open invoice",
  "/link <code> — connect this chat (code from the portal)",
  "/unlink — disconnect this chat",
  "/help — this list"
].join("\n");

async function reply(chatId: string, text: string, template = "command_reply") {
  await sendTelegramMessage(chatId, text, template);
}

async function resolveLink(chatId: string | number) {
  return prisma.telegramLink.findFirst({ where: { chatId: String(chatId), unlinkedAt: null } });
}

async function bindChat(chatId: string, telegramUserId: string | undefined, displayName: string | undefined, principalType: "member" | "owner", principalId: string) {
  const existing = await prisma.telegramLink.findUnique({ where: { chatId } });
  if (existing) {
    await prisma.telegramLink.update({
      where: { id: existing.id },
      data: {
        principalType,
        memberProfileId: principalType === "member" ? principalId : null,
        ownerProfileId: principalType === "owner" ? principalId : null,
        userId: null,
        telegramUserId: telegramUserId ?? null,
        displayName: displayName ?? null,
        unlinkedAt: null,
        linkedAt: new Date()
      }
    });
    return existing.id;
  }
  const created = await prisma.telegramLink.create({
    data: {
      chatId,
      telegramUserId: telegramUserId ?? null,
      displayName: displayName ?? null,
      principalType,
      ...(principalType === "member" ? { memberProfileId: principalId } : { ownerProfileId: principalId }),
      prefs: JSON.stringify({})
    }
  });
  return created.id;
}

/// Handle one Telegram update. The signature check happens first: a spoofed
/// webhook is rejected with 401 (§M21 acceptance). Everything else answers 200
/// (Telegram retries non-2xx deliveries).
export async function handleTelegramUpdate(update: TelegramUpdate, secretHeader: string | null | undefined): Promise<UpdateOutcome> {
  if (!verifyWebhookSecret(secretHeader)) {
    return { status: 401, handled: "rejected: bad webhook signature" };
  }
  const msg = update.message;
  if (!msg?.text) return { status: 200, handled: "ignored: no message text" };

  const chatId = String(msg.chat.id);
  const telegramUserId = msg.from ? String(msg.from.id) : undefined;
  const displayName = msg.from?.username ?? msg.from?.first_name;
  const text = msg.text.trim();

  if (!rateCommand(chatId)) return { status: 200, handled: "rate limited" };

  const [rawCmd, ...rest] = text.split(/\s+/);
  const cmd = rawCmd.split("@")[0]!.toLowerCase();
  const arg = rest.join(" ").trim();

  const link = await resolveLink(chatId);
  const { telegram: botSettings } = await getSettings();
  const botName = botSettings.botName || "RentManager";
  const welcome = botSettings.welcomeMessage || "Welcome! Send /link <code> with the code from your portal (Me → Telegram) to connect.";

  // /link and /start-with-payload work for unlinked chats (gated by M28
  // telegram.allowMemberLinking — self-service member linking)
  if (cmd === "/link" || (cmd === "/start" && arg.length > 0)) {
    if (!botSettings.allowMemberLinking) {
      await reply(chatId, `${botName}: member self-linking is disabled by staff. Contact reception to link your chat.`, "command_reply");
      return { status: 200, handled: "link: disabled by settings" };
    }
    return linkCommand(chatId, telegramUserId, displayName, arg);
  }
  if (cmd === "/start") {
    await reply(chatId, welcome, "command_reply");
    return { status: 200, handled: "start (no code)" };
  }
  if (cmd === "/help") {
    await reply(chatId, `🤖 ${botName} — commands:\n${HELP_TEXT.replace("RentManager bot", botName)}`);
    return { status: 200, handled: "help" };
  }
  if (cmd === "/unlink") {
    return unlinkCommand(chatId, link?.id);
  }

  if (!link) {
    await reply(chatId, "This chat is not linked yet. Open the portal → Me → Telegram, generate a code and send /link <code>.", "command_reply");
    return { status: 200, handled: "command while unlinked" };
  }

  switch (cmd) {
    case "/status":
      return statusCommand(link);
    case "/dues":
      return duesCommand(link);
    case "/pay":
      return payCommand(link);
    default:
      await reply(chatId, `Unknown command ${cmd}.\n\n${HELP_TEXT}`);
      return { status: 200, handled: `unknown command ${cmd}` };
  }
}

// naive per-chat command throttle (the shared in-memory limiter is request-
// keyed; webhook updates arrive one per request so key by chat here)
const commandBuckets = new Map<string, number[]>();
function rateCommand(chatId: string): boolean {
  const now = Date.now();
  const hits = (commandBuckets.get(chatId) ?? []).filter((t) => now - t < 60_000);
  if (hits.length >= 20) {
    commandBuckets.set(chatId, hits);
    return false;
  }
  hits.push(now);
  commandBuckets.set(chatId, hits);
  return true;
}

async function linkCommand(chatId: string, telegramUserId: string | undefined, displayName: string | undefined, code: string): Promise<UpdateOutcome> {
  const row = await consumeLinkCode(code.toUpperCase());
  if (!row) {
    await reply(chatId, "That link code is not valid (or expired). Generate a fresh one in the portal → Me → Telegram.");
    return { status: 200, handled: "link: invalid code" };
  }
  const principalType = row.principalType as "member" | "owner";
  const principalId = (principalType === "member" ? row.memberProfileId : row.ownerProfileId)!;
  await bindChat(chatId, telegramUserId, displayName, principalType, principalId);
  const name =
    principalType === "member"
      ? (await prisma.memberProfile.findUnique({ where: { id: principalId }, include: { party: true } }))?.party.name
      : (await prisma.ownerProfile.findUnique({ where: { id: principalId }, include: { party: true } }))?.party.name;
  await logAudit({
    actorId: null,
    actorName: `telegram:${displayName ?? telegramUserId ?? chatId}`,
    module: "M21",
    action: "telegram.linked",
    entityType: "telegram_link",
    entityId: chatId,
    summary: `Chat ${chatId} linked to ${principalType} ${name ?? principalId} (code ${row.code})`
  });
  await reply(chatId, `✅ Linked! This chat now receives updates for ${name ?? principalType}. Try /status or /dues.`);
  return { status: 200, handled: `linked ${principalType} ${principalId}` };
}

async function unlinkCommand(chatId: string, linkId?: string): Promise<UpdateOutcome> {
  if (!linkId) {
    await reply(chatId, "This chat is not linked.");
    return { status: 200, handled: "unlink: not linked" };
  }
  await prisma.telegramLink.update({ where: { id: linkId }, data: { unlinkedAt: new Date() } });
  await logAudit({
    actorId: null,
    actorName: `telegram:${chatId}`,
    module: "M21",
    action: "telegram.unlinked",
    entityType: "telegram_link",
    entityId: chatId,
    summary: `Chat ${chatId} unlinked`
  });
  await reply(chatId, "Unlinked. You will no longer receive updates here.");
  return { status: 200, handled: "unlinked" };
}

async function statusCommand(link: NonNullable<Awaited<ReturnType<typeof resolveLink>>>): Promise<UpdateOutcome> {
  if (link.principalType === "member" && link.memberProfileId) {
    const { memberDashboard } = await import("@/lib/portal");
    const d = await memberDashboard(link.memberProfileId);
    const room = d.lease ? `Room ${d.lease.room.number} (${d.lease.room.floor.building.name})` : "no active lease";
    await reply(chatIdSafe(link), `🏠 ${room}\nLease: ${d.lease?.status ?? "—"}\nBalance due: ${money(d.balanceMinor)}\nOpen tickets: ${d.openTickets} · complaints: ${d.openComplaints}`);
  } else if (link.principalType === "owner" && link.ownerProfileId) {
    const statements = await prisma.ownerStatement.findMany({ where: { ownerProfileId: link.ownerProfileId }, orderBy: { month: "desc" }, take: 3 });
    const acc = await prisma.ledgerAccount.findUnique({ where: { code: "2200" }, select: { id: true } });
    const agg = acc
      ? await prisma.ledgerEntry.aggregate({ where: { accountId: acc.id }, _sum: { debit: true, credit: true } })
      : null;
    const payable = (agg?._sum.credit ?? 0) - (agg?._sum.debit ?? 0);
    const lines = statements.map((s) => `• ${s.code} (${s.month}): ${s.status}, net ${money(s.netMinor)}`).join("\n");
    await reply(chatIdSafe(link), `📊 Owner statements:\n${lines || "none yet"}\nOwner Payable balance: ${money(payable)}`);
  } else {
    await reply(chatIdSafe(link), "🤖 Staff chat linked. Statement/ops updates will arrive here.");
  }
  return { status: 200, handled: "status" };
}

async function duesCommand(link: NonNullable<Awaited<ReturnType<typeof resolveLink>>>): Promise<UpdateOutcome> {
  if (link.principalType !== "member" || !link.memberProfileId) {
    await reply(chatIdSafe(link), "/dues is for resident chats — owner/staff chats don't carry rent dues.");
    return { status: 200, handled: "dues: not a member" };
  }
  const invoices = await memberOpenInvoices(link.memberProfileId);
  if (invoices.length === 0) {
    await reply(chatIdSafe(link), "💰 You're all settled up — no open invoices.");
    return { status: 200, handled: "dues: none" };
  }
  const lines = invoices.map((i) => `• ${i.code} — ${money(i.amountDueMinor)} (${i.status.replace("_", " ")}${i.dueDate ? `, due ${i.dueDate.toISOString().slice(0, 10)}` : ""})`);
  await reply(chatIdSafe(link), `💰 Your open invoices:\n${lines.join("\n")}\nTotal: ${money(invoices.reduce((s, i) => s + i.amountDueMinor, 0))}`);
  return { status: 200, handled: `dues: ${invoices.length}` };
}

async function payCommand(link: NonNullable<Awaited<ReturnType<typeof resolveLink>>>): Promise<UpdateOutcome> {
  if (link.principalType !== "member" || !link.memberProfileId) {
    await reply(chatIdSafe(link), "/pay is for resident chats.");
    return { status: 200, handled: "pay: not a member" };
  }
  const invoices = await memberOpenInvoices(link.memberProfileId);
  const target = invoices[0];
  if (!target) {
    await reply(chatIdSafe(link), "💰 You're all settled up — nothing to pay.");
    return { status: 200, handled: "pay: none" };
  }
  const qr = await createInvoiceQr(target.id, { id: "telegram-bot", name: "telegram-bot", auditActorId: null });
  if (!qr.ok) {
    await reply(chatIdSafe(link), `Could not start a payment for ${target.code}: ${qr.message}`);
    return { status: 200, handled: `pay: ${qr.code}` };
  }
  await reply(
    chatIdSafe(link),
    `📱 Scan-to-pay ready for ${target.code} — ${money(qr.amountMinor)}.\nPayment ${qr.paymentCode} is pending; the QR is in your portal under Rent, or ask reception to show it. You'll get a confirmation here once the gateway settles.`
  );
  return { status: 200, handled: `pay: qr ${qr.paymentCode}` };
}

// link rows always carry chatId; helper keeps the command signatures tidy
function chatIdSafe(link: { chatId: string }): string {
  return link.chatId;
}

// ── event dispatch (cron-shaped job) ─────────────────────────────────────────

const CURSOR_KEY = "telegram.dispatchCursor";
const MEMBER_EVENT_TEMPLATES = {
  "invoice.issued": "invoiceIssued",
  "payment.confirmed": "paymentReceived",
  "invoice.dunning_reminder": "overdueReminder",
  "ticket.transitioned": "ticketUpdates",
  "complaint.transitioned": "complaintUpdates"
} as const;

async function readCursor(): Promise<{ occurredAt: Date; id: string } | null> {
  const row = await prisma.setting.findUnique({ where: { key: CURSOR_KEY } });
  if (!row) return null;
  try {
    const v = JSON.parse(row.value) as { occurredAt: string; id: string };
    return { occurredAt: new Date(v.occurredAt), id: v.id };
  } catch {
    return null;
  }
}

async function writeCursor(event: { occurredAt: Date; id: string }): Promise<void> {
  await prisma.setting.upsert({
    where: { key: CURSOR_KEY },
    create: { key: CURSOR_KEY, value: JSON.stringify({ occurredAt: event.occurredAt.toISOString(), id: event.id }) },
    update: { value: JSON.stringify({ occurredAt: event.occurredAt.toISOString(), id: event.id }) }
  });
}

export interface DispatchSummary {
  scanned: number;
  notified: number;
  skipped: { noLink: number; prefOff: number; unmapped: number };
  cursor: string | null;
}

/// Process new domain events since the cursor and notify linked chats per the
/// §M21 event → template map. Idempotent (cursor advances only after sends).
export async function dispatchTelegramEvents(max = 100): Promise<DispatchSummary> {
  const cursor = await readCursor();
  const events = await prisma.domainEvent.findMany({
    where: cursor
      ? { OR: [{ occurredAt: { gt: cursor.occurredAt } }, { occurredAt: cursor.occurredAt, id: { gt: cursor.id } }] }
      : {},
    orderBy: [{ occurredAt: "asc" }, { id: "asc" }],
    take: max
  });

  const summary: DispatchSummary = { scanned: events.length, notified: 0, skipped: { noLink: 0, prefOff: 0, unmapped: 0 }, cursor: null };

  for (const event of events) {
    let count = 0;
    try {
      count = await routeEventToChats(event.type, JSON.parse(event.payload) as Record<string, unknown>, summary.skipped);
    } catch {
      count = 0; // a malformed payload must not stall the cursor
    }
    summary.notified += count;
    await writeCursor({ occurredAt: event.occurredAt, id: event.id });
    summary.cursor = event.id;
  }
  return summary;
}

async function routeEventToChats(type: string, payload: Record<string, unknown>, skipped: DispatchSummary["skipped"]): Promise<number> {
  const memberTemplate = MEMBER_EVENT_TEMPLATES[type as keyof typeof MEMBER_EVENT_TEMPLATES];

  if (type === "invoice.issued" || type === "payment.confirmed" || type === "invoice.dunning_reminder") {
    const id = String(payload.invoiceId ?? payload.paymentId ?? "");
    let memberId: string;
    let body: string;
    let tplVars: Record<string, string | number> = {};
    if (type === "invoice.issued") {
      const inv = await prisma.invoice.findUnique({ where: { id }, select: { memberProfileId: true, code: true, totalMinor: true } });
      if (!inv) return 0;
      memberId = inv.memberProfileId;
      tplVars = { code: inv.code, total: money(inv.totalMinor) };
      body = `📄 Invoice ${inv.code} issued — ${money(inv.totalMinor)}. Pay by QR in the portal, or send /pay.`;
    } else if (type === "payment.confirmed") {
      const pay = await prisma.payment.findUnique({ where: { id }, select: { memberProfileId: true, code: true, receiptCode: true, amountMinor: true } });
      if (!pay) return 0;
      memberId = pay.memberProfileId;
      tplVars = { code: pay.code, receipt: pay.receiptCode ?? pay.code, total: money(pay.amountMinor) };
      body = `✅ Payment received — ${pay.receiptCode ?? pay.code} for ${money(pay.amountMinor)}. Thank you!`;
    } else {
      const inv = await prisma.invoice.findUnique({ where: { id }, select: { memberProfileId: true, code: true, amountDueMinor: true } });
      if (!inv) return 0;
      memberId = inv.memberProfileId;
      tplVars = { code: inv.code, due: money(inv.amountDueMinor) };
      body = `⏰ Reminder: invoice ${inv.code} has ${money(inv.amountDueMinor)} outstanding — please settle to avoid late fees.`;
    }
    // §M28 notification templates: an org override replaces the default body
    body = (await getTemplateOverride(type, tplVars)) ?? body;
    const link = await prisma.telegramLink.findFirst({ where: { principalType: "member", memberProfileId: memberId, unlinkedAt: null } });
    if (!link) {
      skipped.noLink += 1;
      return 0;
    }
    if (!prefEnabled(link, memberTemplate)) {
      skipped.prefOff += 1;
      return 0;
    }
    await sendTelegramMessage(link.chatId, body, memberTemplate.replace(/[A-Z]/g, (c) => `_${c.toLowerCase()}`));
    return 1;
  }

  if (type === "ticket.transitioned" || type === "complaint.transitioned") {
    const id = String(payload.ticketId ?? payload.complaintId ?? "");
    const source =
      type === "ticket.transitioned"
        ? await prisma.maintenanceTicket.findUnique({ where: { id }, select: { memberProfileId: true, code: true } })
        : await prisma.complaint.findUnique({ where: { id }, select: { memberProfileId: true, code: true } });
    if (!source) return 0;
    const link = source.memberProfileId
      ? await prisma.telegramLink.findFirst({ where: { principalType: "member", memberProfileId: source.memberProfileId, unlinkedAt: null } })
      : null;
    if (!link) {
      skipped.noLink += 1;
      return 0;
    }
    if (!prefEnabled(link, memberTemplate)) {
      skipped.prefOff += 1;
      return 0;
    }
    const icon = type === "ticket.transitioned" ? "🔧" : "💬";
    const kind = type === "ticket.transitioned" ? "Ticket" : "Complaint";
    await sendTelegramMessage(link.chatId, `${icon} ${kind} ${source.code}: ${payload.from} → ${payload.to}.`, memberTemplate.replace(/[A-Z]/g, (c) => `_${c.toLowerCase()}`));
    return 1;
  }

  if (type === "statement.approved") {
    const st = await prisma.ownerStatement.findUnique({ where: { id: String(payload.statementId ?? "") }, select: { ownerProfileId: true, code: true, netMinor: true, month: true } });
    if (!st) return 0;
    const link = await prisma.telegramLink.findFirst({ where: { principalType: "owner", ownerProfileId: st.ownerProfileId, unlinkedAt: null } });
    if (!link) {
      skipped.noLink += 1;
      return 0;
    }
    if (!prefEnabled(link, "statementReady")) {
      skipped.prefOff += 1;
      return 0;
    }
    await sendTelegramMessage(link.chatId, `📊 Owner statement ${st.code} (${st.month}) is ready — net payout ${money(st.netMinor)}. The PDF is in your portal.`, "statement_ready");
    return 1;
  }

  if (type === "stock.low") {
    const links = await prisma.telegramLink.findMany({ where: { principalType: "user", unlinkedAt: null } });
    let count = 0;
    for (const link of links) {
      if (!prefEnabled(link, "lowStock")) {
        skipped.prefOff += 1;
        continue;
      }
      await sendTelegramMessage(
        link.chatId,
        `📦 Low stock: ${String(payload.name ?? "item")} at ${Number(payload.qtyMilli ?? 0) / 1000} (min ${Number(payload.minQtyMilli ?? 0) / 1000}).`,
        "low_stock"
      );
      count += 1;
    }
    if (links.length === 0) skipped.noLink += 1;
    return count;
  }

  skipped.unmapped += 1;
  return 0;
}

/// §M21 "occupancy digest (staff/admin)" — daily cron shape: one message per
/// staff-linked chat with the per-property room status rollup.
export async function sendOccupancyDigest(): Promise<number> {
  const props = await prisma.property.findMany({ select: { code: true, name: true, buildings: { select: { floors: { select: { rooms: { select: { status: true } } } } } } } });
  const parts = props.map((p) => {
    const rooms = p.buildings.flatMap((b) => b.floors.flatMap((f) => f.rooms));
    const total = rooms.length;
    const occupied = rooms.filter((r) => r.status === "occupied").length;
    const pct = total === 0 ? 0 : Math.round((occupied / total) * 100);
    return `• ${p.name}: ${occupied}/${total} occupied (${pct}%)`;
  });
  const body = `🏨 Occupancy digest\n${parts.join("\n")}`;
  const links = await prisma.telegramLink.findMany({ where: { principalType: "user", unlinkedAt: null } });
  let count = 0;
  for (const link of links) {
    if (!prefEnabled(link, "occupancyDigest")) continue;
    await sendTelegramMessage(link.chatId, body, "occupancy_digest");
    count += 1;
  }
  return count;
}
