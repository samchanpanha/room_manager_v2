import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";

type DbClient = Prisma.TransactionClient | typeof prisma;

/// Emit a domain event (used later for notifications/outbox and integrations).
/// Pass an interactive-transaction client when emitting from inside a
/// transaction — nested root-client writes deadlock on SQLite and risk
/// lock contention on PostgreSQL.
export async function emitDomainEvent(
  type: string,
  payload: Record<string, unknown>,
  propertyId?: string | null,
  client: DbClient = prisma
): Promise<void> {
  await client.domainEvent.create({
    data: { type, payload: JSON.stringify(payload), propertyId: propertyId ?? null }
  });
}
