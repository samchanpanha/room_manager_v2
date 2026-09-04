/// One-time Phase 21 backfill: chain audit rows written before the hash columns.
import { backfillAuditChain } from "@/lib/audit";
import { prisma } from "@/lib/db";

backfillAuditChain()
  .then((n) => {
    console.log(`chained ${n} audit rows`);
    return prisma.$disconnect();
  })
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
