/// §M28 data retention: purge outbox rows, domain events, consumed/expired
/// OTPs and dead sessions past the configured windows. AuditLog is NEVER
/// purged — the tamper-evident trail is permanent by design.
import { prisma } from "@/lib/db";
import { getSettings } from "@/lib/settings";
import { logAudit } from "@/lib/audit";

const DAY = 24 * 60 * 60 * 1000;

export interface RetentionResult {
  outbox: number;
  events: number;
  otps: number;
  sessions: number;
}

export async function runRetentionPurge(actor: { id?: string | null; name: string }, ip: string | null): Promise<RetentionResult> {
  const { retention } = await getSettings();
  const now = Date.now();
  const outboxCutoff = new Date(now - retention.outboxDays * DAY);
  const eventCutoff = new Date(now - retention.eventDays * DAY);
  const otpCutoff = new Date(now - retention.otpDays * DAY);
  const sessionCutoff = new Date(now - retention.sessionDays * DAY);

  const outbox = await prisma.telegramOutbox.deleteMany({ where: { createdAt: { lt: outboxCutoff } } });
  const events = await prisma.domainEvent.deleteMany({ where: { occurredAt: { lt: eventCutoff } } });
  const otps = await prisma.memberOtp.deleteMany({ where: { OR: [{ expiresAt: { lt: otpCutoff } }, { consumedAt: { lt: otpCutoff } }] } });
  const sessions = await prisma.session.deleteMany({
    where: { OR: [{ expiresAt: { lt: new Date() } }, { revokedAt: { lt: sessionCutoff } }] }
  });

  await logAudit({
    actorId: actor.id ?? null,
    actorName: actor.name,
    module: "M28",
    action: "delete",
    entityType: "retention",
    summary: `Retention purge: ${outbox.count} outbox, ${events.count} events, ${otps.count} OTPs, ${sessions.count} sessions`,
    ip
  });
  return { outbox: outbox.count, events: events.count, otps: otps.count, sessions: sessions.count };
}
