import { z } from "zod";
import { clientIp, fail, ok, parseBody } from "@/lib/api";
import { getAuthUser } from "@/lib/auth/session";
import { authorize } from "@/lib/rbac/guard";
import { hasModuleAccess } from "@/lib/rbac/can";
import { prisma } from "@/lib/db";
import { logAudit } from "@/lib/audit";

export async function GET() {
  const user = await getAuthUser();
  if (!user) return fail(401, "UNAUTHENTICATED", "Sign in required");
  if (!hasModuleAccess(user, "read", "M06")) return fail(403, "FORBIDDEN", "Missing permission M06:read");

  const [lateFee, tax, dunning, generation, plans] = await Promise.all([
    prisma.lateFeeRule.findFirst({ where: { isActive: true } }),
    prisma.taxRule.findFirst({ where: { isActive: true, isDefault: true } }),
    prisma.setting.findUnique({ where: { key: "billing.dunning" } }),
    prisma.setting.findUnique({ where: { key: "billing.generation" } }),
    prisma.rentPlan.findMany({ where: { isActive: true }, orderBy: { name: "asc" } })
  ]);

  return ok({
    lateFeeRule: lateFee,
    taxRule: tax,
    dunningSchedule: dunning ? (JSON.parse(dunning.value) as { scheduleDays: number[] }).scheduleDays : [3, 7, 14],
    generationLeadDays: generation ? (JSON.parse(generation.value) as { leadDays: number }).leadDays : 3,
    rentPlans: plans
  });
}

const putSchema = z.object({
  graceDays: z.coerce.number().int().min(0).max(90).optional(),
  lateFeeType: z.enum(["FIXED", "PERCENT"]).optional(),
  lateFeeAmount: z.coerce.number().min(0).optional(),
  lateFeePercent: z.coerce.number().min(0).max(100).optional(),
  lateFeeCap: z.coerce.number().min(0).optional(),
  taxPercent: z.coerce.number().min(0).max(100).optional(),
  generationLeadDays: z.coerce.number().int().min(0).max(28).optional()
});

export async function PUT(req: Request) {
  const parsed = await parseBody(req, putSchema);
  if (parsed.response) return parsed.response;
  const g = await authorize("update", "M06");
  if (g.response) return g.response;
  const d = parsed.data;

  const before = {
    lateFee: await prisma.lateFeeRule.findFirst({ where: { isActive: true } }),
    tax: await prisma.taxRule.findFirst({ where: { isActive: true, isDefault: true } }),
    generation: await prisma.setting.findUnique({ where: { key: "billing.generation" } })
  };

  if (d.graceDays !== undefined || d.lateFeeType !== undefined || d.lateFeeAmount !== undefined || d.lateFeePercent !== undefined || d.lateFeeCap !== undefined) {
    const rule = await prisma.lateFeeRule.findFirst({ where: { isActive: true } });
    if (rule) {
      await prisma.lateFeeRule.update({
        where: { id: rule.id },
        data: {
          graceDays: d.graceDays,
          type: d.lateFeeType,
          amountMinor: d.lateFeeAmount === undefined ? undefined : Math.round(d.lateFeeAmount * 100) || null,
          percentBps: d.lateFeePercent === undefined ? undefined : Math.round(d.lateFeePercent * 100) || null,
          capMinor: d.lateFeeCap === undefined ? undefined : Math.round(d.lateFeeCap * 100) || null
        }
      });
    }
  }
  if (d.taxPercent !== undefined) {
    const tax = await prisma.taxRule.findFirst({ where: { isActive: true, isDefault: true } });
    if (tax) {
      await prisma.taxRule.update({ where: { id: tax.id }, data: { percentBps: Math.round(d.taxPercent * 100) } });
    }
  }
  if (d.generationLeadDays !== undefined) {
    await prisma.setting.upsert({
      where: { key: "billing.generation" },
      create: { key: "billing.generation", value: JSON.stringify({ leadDays: d.generationLeadDays }), updatedBy: g.user.id },
      update: { value: JSON.stringify({ leadDays: d.generationLeadDays }), updatedBy: g.user.id }
    });
  }

  await logAudit({
    actorId: g.user.id,
    actorName: g.user.name,
    module: "M06",
    action: "update",
    entityType: "rent_engine_rules",
    entityId: null,
    summary: `Updated rent engine rules: ${Object.keys(d).join(", ")}`,
    before: { lateFee: before.lateFee, taxPercentBps: before.tax?.percentBps, generation: before.generation?.value },
    after: d,
    ip: clientIp(req)
  });
  return ok({ saved: true });
}
