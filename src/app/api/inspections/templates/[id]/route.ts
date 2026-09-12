import { z } from "zod";
import { Prisma } from "@prisma/client";
import { fail, ok, parseBody } from "@/lib/api";
import { getAuthUser } from "@/lib/auth/session";
import { hasModuleAccess } from "@/lib/rbac/can";
import { prisma } from "@/lib/db";
import { logAudit } from "@/lib/audit";

const updateSchema = z.object({
  name: z.string().min(1).max(120).optional(),
  roomType: z.enum(["STANDARD", "DELUXE", "STUDIO", "SUITE"]).optional(),
  sections: z
    .array(
      z.object({
        title: z.string().min(1).max(100),
        items: z.array(z.string().min(1).max(200)).min(1)
      })
    )
    .optional(),
  isActive: z.boolean().optional()
});

export async function PUT(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const user = await getAuthUser();
  if (!user) return fail(401, "UNAUTHENTICATED", "Sign in required");
  if (!hasModuleAccess(user, "update", "M28") && !hasModuleAccess(user, "update", "M18")) {
    return fail(403, "FORBIDDEN", "Admin permission required to update inspection templates");
  }

  const parsed = await parseBody(req, updateSchema);
  if (parsed.response) return parsed.response;

  const existing = await prisma.inspectionTemplate.findUnique({ where: { id } });
  if (!existing) return fail(404, "NOT_FOUND", "Inspection template not found");

  const d = parsed.data;
  const updated = await prisma.inspectionTemplate.update({
    where: { id },
    data: {
      name: d.name ?? existing.name,
      roomType: d.roomType ?? existing.roomType,
      sections: d.sections ? (d.sections as unknown as Prisma.InputJsonValue) : undefined,
      isActive: d.isActive !== undefined ? d.isActive : existing.isActive
    }
  });

  await logAudit({
    actorId: user.id,
    actorName: user.name,
    module: "M18",
    action: "update",
    entityType: "inspection_template",
    entityId: updated.id,
    summary: `Updated inspection template "${updated.name}" (${updated.roomType})`
  });

  return ok({ template: updated });
}

export async function DELETE(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const user = await getAuthUser();
  if (!user) return fail(401, "UNAUTHENTICATED", "Sign in required");
  if (!hasModuleAccess(user, "update", "M28") && !hasModuleAccess(user, "delete", "M18")) {
    return fail(403, "FORBIDDEN", "Admin permission required to delete inspection templates");
  }

  const existing = await prisma.inspectionTemplate.findUnique({ where: { id } });
  if (!existing) return fail(404, "NOT_FOUND", "Inspection template not found");

  // Check if used in inspections
  const count = await prisma.inspection.count({ where: { templateId: id } });
  if (count > 0) {
    // Soft-deactivate if referenced by historical inspections
    const deactivated = await prisma.inspectionTemplate.update({
      where: { id },
      data: { isActive: false }
    });
    return ok({ message: "Template is linked to existing inspections — deactivated instead of deleted", template: deactivated });
  }

  await prisma.inspectionTemplate.delete({ where: { id } });

  await logAudit({
    actorId: user.id,
    actorName: user.name,
    module: "M18",
    action: "delete",
    entityType: "inspection_template",
    entityId: id,
    summary: `Deleted inspection template "${existing.name}" (${existing.roomType})`
  });

  return ok({ deleted: true });
}
