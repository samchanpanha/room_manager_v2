process.env.DATABASE_URL = "file:./dev.db";
import { PrismaClient } from "@prisma/client";
const p = new PrismaClient();
async function main() {
  const prop = await p.property.findFirstOrThrow({ where: { code: "GLD" }, select: { id: true } });
  const owner = await p.ownerProfile.findFirstOrThrow({ where: { party: { name: { contains: "Piseth" } } }, select: { id: true } });
  const m1 = await p.memberProfile.findFirstOrThrow({ where: { party: { name: { contains: "Dara" } } }, select: { id: true } });
  const m2 = await p.memberProfile.findFirstOrThrow({ where: { party: { name: { contains: "Sokha" } } }, select: { id: true } });
  const roomA = await p.room.findFirstOrThrow({ where: { number: "G-101", floor: { building: { property: { code: "GLD" } } } }, select: { id: true } });
  const roomB = await p.room.findFirstOrThrow({ where: { number: "G-102", floor: { building: { property: { code: "GLD" } } } }, select: { id: true } });
  const meter = await p.meter.findFirstOrThrow({ where: { code: "GLD-EL-G101" }, select: { id: true } });
  const pay1 = await p.payment.findFirstOrThrow({ where: { code: "PMT-2026-0001" }, select: { id: true } });
  const pay2 = await p.payment.findFirstOrThrow({ where: { code: "PMT-2026-0002" }, select: { id: true } });
  const mov = await p.roomMove.findFirstOrThrow({ where: { code: "MOV-2026-0003" }, select: { id: true, newLeaseId: true } });
  const cmp = await p.complaint.findFirstOrThrow({ where: { code: "CMP-2026-0001" }, select: { id: true } });
  const tk = await p.maintenanceTicket.findFirstOrThrow({ where: { code: "TK-2026-0001" }, select: { id: true } });
  const stock = await p.stockItem.findFirstOrThrow({ where: { name: { contains: "condensate" } }, select: { id: true } });
  const inv = async (code: string) => (await p.invoice.findUniqueOrThrow({ where: { code }, select: { id: true } })).id;
  const lease = async (code: string) => (await p.lease.findUniqueOrThrow({ where: { code }, select: { id: true } })).id;
  const lines = [
    "PID=" + prop.id, "OID=" + owner.id, "MID=" + m1.id, "M2ID=" + m2.id,
    "ROOM_A=" + roomA.id, "ROOM_B=" + roomB.id, "METID=" + meter.id,
    "LID=" + (await lease("LSE-0003")), "L3ID=" + (await lease("LSE-0006")), "NEWLID=" + (mov.newLeaseId ?? ""),
    "I3=" + (await inv("GLD-2026-0003")), "I4=" + (await inv("GLD-2026-0004")), "I5=" + (await inv("GLD-2026-0005")),
    "PAYID=" + pay1.id, "PAY2ID=" + pay2.id, "MVID3=" + mov.id, "CMPID=" + cmp.id, "TICKID=" + tk.id, "SID=" + stock.id,
  ];
  console.log(lines.join("\n"));
}
main().then(() => process.exit(0)).catch((e) => { console.error(String(e).slice(0, 200)); process.exit(1); });
