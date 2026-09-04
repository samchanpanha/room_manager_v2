import { z } from "zod";
import { clientIp, fail, ok, parseBody } from "@/lib/api";
import { authorize } from "@/lib/rbac/guard";
import { prisma } from "@/lib/db";
import { logAudit } from "@/lib/audit";

const schema = z.object({
  chatId: z.string().min(3).max(64),
  telegramUserId: z.string().max(64).optional(),
  userId: z.string().min(1)
});

/// §M21 staff events (ticket assignment, low stock, occupancy digest) need
/// staff chats: STAFF holds no M21 grant, so an Admin (M21:update, GLOBAL)
/// binds a chat to a staff user on their behalf.
export async function POST(req: Request) {
  const parsed = await parseBody(req, schema);
  if (parsed.response) return parsed.response;
  const g = await authorize("update", "M21");
  if (g.response) return g.response;

  const staff = await prisma.user.findUnique({ where: { id: parsed.data.userId }, select: { id: true, name: true } });
  if (!staff) return fail(404, "NOT_FOUND", "User not found");
  const existing = await prisma.telegramLink.findUnique({ where: { chatId: parsed.data.chatId } });
  const link = existing
    ? await prisma.telegramLink.update({
        where: { id: existing.id },
        data: { principalType: "user", memberProfileId: null, ownerProfileId: null, userId: staff.id, telegramUserId: parsed.data.telegramUserId ?? null, unlinkedAt: null, linkedAt: new Date() }
      })
    : await prisma.telegramLink.create({
        data: { chatId: parsed.data.chatId, principalType: "user", userId: staff.id, telegramUserId: parsed.data.telegramUserId ?? null, displayName: staff.name }
      });
  await logAudit({
    actorId: g.user.id,
    actorName: g.user.name,
    module: "M21",
    action: "telegram.linked",
    entityType: "telegram_link",
    entityId: link.chatId,
    summary: `Chat ${link.chatId} linked to staff ${staff.name} by admin`,
    ip: clientIp(req)
  });
  return ok({ chatId: link.chatId, principalType: "user", userId: staff.id }, existing ? 200 : 201);
}
