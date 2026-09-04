import { ok } from "@/lib/api";
import { prisma } from "@/lib/db";

export async function GET() {
  await prisma.$queryRaw`SELECT 1`;
  return ok({ status: "ok", time: new Date().toISOString() });
}
