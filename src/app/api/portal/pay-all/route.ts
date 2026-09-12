import { z } from "zod";
import { fail, ok, parseBody } from "@/lib/api";
import { getAuthUser } from "@/lib/auth/session";
import { getMemberForUser } from "@/lib/portal";
import { createMemberPayAllQr } from "@/lib/qrpay/service";
import { isProviderName } from "@/lib/qrpay/adapter";

const schema = z.object({
  provider: z.string().max(20).optional()
});

/// M25 portal: one QR covering the signed-in member's entire outstanding
/// balance (Σ all open invoices, §9.5 FIFO on confirm). Strictly OWN — the
/// member can only pay their own balance.
export async function POST(req: Request) {
  const parsed = await parseBody(req, schema);
  if (parsed.response) return parsed.response;

  const user = await getAuthUser();
  if (!user) return fail(401, "UNAUTHENTICATED", "Sign in required");
  const member = await getMemberForUser(user);
  if (!member) return fail(403, "FORBIDDEN", "No member profile linked to this account");

  let provider: string | undefined;
  if (parsed.data.provider) {
    if (!isProviderName(parsed.data.provider)) return fail(400, "INVALID_PROVIDER", "Unknown QR provider");
    provider = parsed.data.provider;
  }

  const result = await createMemberPayAllQr(member.id, { id: user.id, name: user.name }, { provider });
  if (!result.ok) {
    const status =
      result.code === "NOT_FOUND" ? 404 : result.code === "NOTHING_DUE" || result.code === "ALREADY_SETTLED" ? 422 : 400;
    return fail(status, result.code, result.message);
  }
  return ok(result);
}