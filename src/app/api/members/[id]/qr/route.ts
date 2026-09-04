import { fail, ok } from "@/lib/api";
import { getAuthUser } from "@/lib/auth/session";
import { can } from "@/lib/rbac/can";
import { prisma } from "@/lib/db";
import { signMemberToken, memberPayQrDataUrl } from "@/lib/qrpay/tokens";
import { env } from "@/lib/env";

/// Member pay QR (§M13 static/member QR): encodes {APP_BASE_URL}/pay?m=<signed
/// token>. Members fetch their own; staff with M02 read in scope can fetch it
/// for printing posters/invoice inserts.
export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const user = await getAuthUser();
  if (!user) return fail(401, "UNAUTHENTICATED", "Sign in required");

  const member = await prisma.memberProfile.findUnique({ where: { id }, select: { homePropertyId: true } });
  if (!member) return fail(404, "NOT_FOUND", "Member not found");

  const own = user.partyId
    ? (await prisma.memberProfile.findUnique({ where: { partyId: user.partyId }, select: { id: true } }))?.id ?? null
    : null;
  if (own !== id && !can(user, "read", "M02", { propertyId: member.homePropertyId ?? undefined })) {
    return fail(403, "FORBIDDEN", "Missing permission M02:read for this member");
  }

  const token = signMemberToken(id);
  const imageDataUrl = await memberPayQrDataUrl(env.APP_BASE_URL, id);
  return ok({ token, imageDataUrl, payUrl: `${env.APP_BASE_URL.replace(/\/$/, "")}/pay?m=${encodeURIComponent(token)}` });
}
