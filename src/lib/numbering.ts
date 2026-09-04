/// Gapless sequence numbers (INTENT.md M00 number_sequences).
import { prisma } from "@/lib/db";

export async function nextNumber(key: string, format: (n: number) => string): Promise<string> {
  return prisma.$transaction(async (tx) => {
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
