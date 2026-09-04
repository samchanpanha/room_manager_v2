import { z } from "zod";
import { fail, ok, parseBody } from "@/lib/api";
import { getAuthUser } from "@/lib/auth/session";
import { can } from "@/lib/rbac/can";
import { prisma } from "@/lib/db";

const schema = z.object({ name: z.string().min(2).max(120), phone: z.string().max(40).optional(), email: z.string().email().max(160).optional(), notes: z.string().max(300).optional() });

export async function GET() {
  const user = await getAuthUser();
  if (!user) return fail(401, "UNAUTHENTICATED", "Sign in required");
  if (!can(user, "read", "M15")) return fail(403, "FORBIDDEN", "Missing permission M15:read");
  const suppliers = await prisma.supplier.findMany({ orderBy: { name: "asc" } });
  return ok({ suppliers });
}

export async function POST(req: Request) {
  const parsed = await parseBody(req, schema);
  if (parsed.response) return parsed.response;
  const user = await getAuthUser();
  if (!user) return fail(401, "UNAUTHENTICATED", "Sign in required");
  if (!can(user, "create", "M15")) return fail(403, "FORBIDDEN", "Missing permission M15:create");
  const supplier = await prisma.supplier.create({ data: { name: parsed.data.name.trim(), phone: parsed.data.phone, email: parsed.data.email, notes: parsed.data.notes } });
  return ok({ id: supplier.id }, 201);
}
