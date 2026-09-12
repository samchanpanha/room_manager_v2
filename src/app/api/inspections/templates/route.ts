import { z } from "zod";
import { Prisma } from "@prisma/client";
import { fail, ok, parseBody } from "@/lib/api";
import { getAuthUser } from "@/lib/auth/session";
import { hasModuleAccess } from "@/lib/rbac/can";
import { prisma } from "@/lib/db";
import { logAudit } from "@/lib/audit";

const sectionSchema = z.object({
  title: z.string().min(1).max(100),
  items: z.array(z.string().min(1).max(200)).min(1)
});

const templateSchema = z.object({
  name: z.string().min(1).max(120),
  roomType: z.enum(["STANDARD", "DELUXE", "STUDIO", "SUITE"]),
  sections: z.array(sectionSchema).min(1),
  isActive: z.boolean().default(true)
});

/// GET /api/inspections/templates — list all inspection templates
export async function GET() {
  const user = await getAuthUser();
  if (!user) return fail(401, "UNAUTHENTICATED", "Sign in required");
  if (!hasModuleAccess(user, "read", "M18") && !hasModuleAccess(user, "read", "M28")) {
    return fail(403, "FORBIDDEN", "Missing permission to view inspection templates");
  }

  const templates = await prisma.inspectionTemplate.findMany({
    orderBy: [{ roomType: "asc" }, { name: "asc" }]
  });

  return ok({ templates });
}

/// POST /api/inspections/templates — create a new inspection template
export async function POST(req: Request) {
  const user = await getAuthUser();
  if (!user) return fail(401, "UNAUTHENTICATED", "Sign in required");
  if (!hasModuleAccess(user, "update", "M28") && !hasModuleAccess(user, "create", "M18")) {
    return fail(403, "FORBIDDEN", "Admin permission required to manage inspection templates");
  }

  const parsed = await parseBody(req, templateSchema);
  if (parsed.response) return parsed.response;

  const d = parsed.data;
  const existing = await prisma.inspectionTemplate.findUnique({
    where: { name_roomType: { name: d.name, roomType: d.roomType } }
  });
  if (existing) {
    return fail(409, "DUPLICATE", `Template "${d.name}" for room type "${d.roomType}" already exists`);
  }

  const created = await prisma.inspectionTemplate.create({
    data: {
      name: d.name,
      roomType: d.roomType,
      sections: d.sections as unknown as Prisma.InputJsonValue,
      isActive: d.isActive
    }
  });

  await logAudit({
    actorId: user.id,
    actorName: user.name,
    module: "M18",
    action: "create",
    entityType: "inspection_template",
    entityId: created.id,
    summary: `Created inspection template "${created.name}" (${created.roomType}) with ${d.sections.length} sections`
  });

  return ok({ template: created }, 201);
}
