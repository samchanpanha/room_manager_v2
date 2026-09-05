import { NextRequest } from "next/server";
import { z } from "zod";
import { clientIp, fail, ok, parseBody } from "@/lib/api";
import { getAuthUser } from "@/lib/auth/session";
import { hasModuleAccess } from "@/lib/rbac/can";
import { prisma } from "@/lib/db";
import {
  cancelBooking,
  checkInBooking,
  checkOutBooking,
  confirmBooking,
  noShowBooking,
  voidBooking
} from "@/lib/operations/stay-service";

const actionSchema = z.object({
  action: z.enum(["confirm", "checkin", "checkout", "cancel", "void", "no_show"]),
  payMethod: z.enum(["cash", "qr", "card"]).optional(),
  depositMethod: z.enum(["cash", "qr", "card"]).optional(),
  extendTo: z.string().optional(),
  reason: z.string().max(300).optional()
});

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const ip = clientIp(req);
  const user = await getAuthUser();
  if (!user) return fail(401, "UNAUTHENTICATED", "Sign in required");
  if (!hasModuleAccess(user, "update", "M32")) return fail(403, "FORBIDDEN", "Missing permission M32:update");
  const { id } = await ctx.params;
  const parsed = await parseBody(req, actionSchema);
  if (parsed.response) return parsed.response;
  const actor = { id: user.id, name: user.name };

  const existing = await prisma.stayBooking.findUnique({ where: { id }, select: { propertyId: true } });
  if (!existing) return fail(404, "NOT_FOUND", "Booking not found");

  switch (parsed.data.action) {
    case "confirm": {
      const r = await confirmBooking(id, actor);
      return r.ok ? ok(r.data) : fail(r.code === "UNAVAILABLE" ? 409 : 400, r.code, r.message);
    }
    case "checkin": {
      const r = await checkInBooking(id, actor);
      return r.ok ? ok(r.data) : fail(r.code === "UNAVAILABLE" ? 409 : 400, r.code, r.message);
    }
    case "checkout": {
      if (!parsed.data.payMethod) return fail(400, "PAY_METHOD_REQUIRED", "checkout needs payMethod");
      const r = await checkOutBooking(id, { payMethod: parsed.data.payMethod, depositMethod: parsed.data.depositMethod, extendTo: parsed.data.extendTo ? new Date(parsed.data.extendTo) : undefined }, actor, ip);
      return r.ok ? ok(r.data) : fail(400, r.code, r.message);
    }
    case "cancel": {
      const r = await cancelBooking(id, actor);
      return r.ok ? ok(r.data) : fail(400, r.code, r.message);
    }
    case "void": {
      if (!parsed.data.reason) return fail(400, "REASON_REQUIRED", "void needs a reason");
      const r = await voidBooking(id, parsed.data.reason, actor, ip);
      return r.ok ? ok(r.data) : fail(400, r.code, r.message);
    }
    case "no_show": {
      const r = await noShowBooking(id, actor);
      return r.ok ? ok(r.data) : fail(400, r.code, r.message);
    }
  }
}