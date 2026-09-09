/// Gapless sequence numbers (INTENT.md M00 number_sequences).
import { prisma } from "@/lib/db";

export async function nextNumber(key: string, format: (n: number) => string): Promise<string> {
  return prisma.$transaction(async (tx) => {
    // Dynamic sequence alignment for entities that may have pre-seeded or manual records
    if (key === "LEASE") {
      const leases = await tx.lease.findMany({
        select: { code: true },
        where: { code: { startsWith: "LSE-" } },
        orderBy: { code: "desc" },
        take: 50
      });
      let maxNum = 0;
      for (const l of leases) {
        const m = l.code.match(/(\d+)$/);
        if (m && m[1]) {
          const v = parseInt(m[1], 10);
          if (v > maxNum) maxNum = v;
        }
      }
      const seq = await tx.numberSequence.findUnique({ where: { key } });
      const nextVal = Math.max(seq?.value ?? 0, maxNum) + 1;
      await tx.numberSequence.upsert({
        where: { key },
        create: { key, value: nextVal },
        update: { value: nextVal }
      });
      return format(nextVal);
    }

    if (key === "OWC") {
      const contracts = await tx.ownerContract.findMany({
        select: { code: true },
        where: { code: { startsWith: "OWC-" } },
        orderBy: { code: "desc" },
        take: 50
      });
      let maxNum = 0;
      for (const c of contracts) {
        const m = c.code.match(/(\d+)$/);
        if (m && m[1]) {
          const v = parseInt(m[1], 10);
          if (v > maxNum) maxNum = v;
        }
      }
      const seq = await tx.numberSequence.findUnique({ where: { key } });
      const nextVal = Math.max(seq?.value ?? 0, maxNum) + 1;
      await tx.numberSequence.upsert({
        where: { key },
        create: { key, value: nextVal },
        update: { value: nextVal }
      });
      return format(nextVal);
    }

    const row = await tx.numberSequence.upsert({
      where: { key },
      create: { key, value: 1 },
      update: { value: { increment: 1 } }
    });
    // upsert.update with increment returns the row pre-increment in some
    // engines — re-read to be certain:
    const current = await tx.numberSequence.findUniqueOrThrow({ where: { key } });
    void row;
    return format(current.value);
  });
}
