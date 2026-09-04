import { fail, ok } from "@/lib/api";
import { getAuthUser } from "@/lib/auth/session";
import { can } from "@/lib/rbac/can";
import { prisma } from "@/lib/db";
import { createInvoiceQr } from "@/lib/qrpay/service";
import { isProviderName } from "@/lib/qrpay/adapter";

/// Dynamic QR for one invoice (§M13): members may pay their own invoice
/// (M13:O create), staff need M13:create in the invoice's property scope.
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const user = await getAuthUser();
  if (!user) return fail(401, "UNAUTHENTICATED", "Sign in required");

  const invoice = await prisma.invoice.findUnique({ where: { id }, select: { memberProfileId: true, propertyId: true, status: true } });
  if (!invoice) return fail(404, "NOT_FOUND", "Invoice not found");

  let ownMemberId: string | null = null;
  if (user.partyId) {
    const profile = await prisma.memberProfile.findUnique({ where: { partyId: user.partyId }, select: { id: true } });
    ownMemberId = profile?.id ?? null;
  }
  const isOwnInvoice = ownMemberId != null && ownMemberId === invoice.memberProfileId;
  if (!isOwnInvoice && !can(user, "create", "M13", { propertyId: invoice.propertyId })) {
    return fail(403, "FORBIDDEN", "Missing permission M13:create for this invoice");
  }

  let provider: string | undefined;
  try {
    const body = (await req.json().catch(() => ({}))) as { provider?: string };
    if (body.provider && !isProviderName(body.provider)) return fail(400, "INVALID_PROVIDER", "Unknown QR provider");
    provider = body.provider;
  } catch {
    provider = undefined;
  }

  const result = await createInvoiceQr(id, { id: user.id, name: user.name }, { provider });
  if (!result.ok) {
    const status = result.code === "NOT_FOUND" ? 404 : result.code === "NOTHING_DUE" || result.code === "INVOICE_VOID" || result.code === "ALREADY_SETTLED" ? 422 : 400;
    return fail(status, result.code, result.message);
  }
  return ok(result);
}
