import { z } from "zod";
import { clientIp, fail, ok, parseBody } from "@/lib/api";
import { authorize } from "@/lib/rbac/guard";
import { prisma } from "@/lib/db";
import { recordReading } from "@/lib/utilities/service";
import { toMilli } from "@/lib/utilities/machines";

const schema = z
  .object({
    value: z.coerce.number().min(0).optional(),
    estimate: z.boolean().optional(),
    readAt: z.string().datetime().optional(),
    note: z.string().max(300).optional()
  })
  .refine((d) => d.estimate === true || d.value != null, { message: "value is required unless estimate: true" });

/// Record a meter reading (manual, or estimated = avg last 3, §M11).
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const parsed = await parseBody(req, schema);
  if (parsed.response) return parsed.response;
  const meter = await prisma.meter.findUnique({ where: { id }, include: { room: { include: { floor: { include: { building: true } } } } } });
  if (!meter) return fail(404, "NOT_FOUND", "Meter not found");
  const g = await authorize("create", "M11", { propertyId: meter.room.floor.building.propertyId });
  if (g.response) return g.response;

  const result = await recordReading(
    id,
    {
      valueMilli: parsed.data.value != null ? toMilli(parsed.data.value) : undefined,
      estimate: parsed.data.estimate,
      readAt: parsed.data.readAt ? new Date(parsed.data.readAt) : undefined,
      note: parsed.data.note
    },
    { id: g.user.id, name: g.user.name },
    clientIp(req)
  );
  if (!result.ok) {
    return fail(result.code === "NOT_FOUND" ? 404 : 422, result.code, result.message);
  }
  return ok(result.data, 201);
}
