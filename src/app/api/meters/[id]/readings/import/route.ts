import { z } from "zod";
import { clientIp, fail, ok, parseBody } from "@/lib/api";
import { authorize } from "@/lib/rbac/guard";
import { prisma } from "@/lib/db";
import { importReadingsCsv } from "@/lib/utilities/service";

const schema = z.object({ csv: z.string().min(1).max(100_000) });

/// CSV import (§M11): rows `YYYY-MM-DD,value[,note]` in display units.
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const parsed = await parseBody(req, schema);
  if (parsed.response) return parsed.response;
  const meter = await prisma.meter.findUnique({ where: { id }, include: { room: { include: { floor: { include: { building: true } } } } } });
  if (!meter) return fail(404, "NOT_FOUND", "Meter not found");
  const g = await authorize("create", "M11", { propertyId: meter.room.floor.building.propertyId });
  if (g.response) return g.response;
  const result = await importReadingsCsv(id, parsed.data.csv, { id: g.user.id, name: g.user.name }, clientIp(req));
  if (!result.ok) return fail(result.code === "NOT_FOUND" ? 404 : 422, result.code, result.message);
  return ok(result.data);
}
