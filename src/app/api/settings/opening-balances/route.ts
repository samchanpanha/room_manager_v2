import { fail, ok, parseBody, clientIp } from "@/lib/api";
import { getAuthUser } from "@/lib/auth/session";
import { postTransaction } from "@/lib/ledger/service";
import { prisma } from "@/lib/db";
import { logAudit } from "@/lib/audit";
import { hasModuleAccess } from "@/lib/rbac/can";
import { z } from "zod";

const bodySchema = z.object({
  memo: z.string().min(3).max(200).default("Opening balances (M28)"),
  lines: z
    .array(
      z.object({
        code: z.string().regex(/^\d{4}$/),
        direction: z.enum(["debit", "credit"]),
        amountMinor: z.number().int().positive()
      })
    )
    .min(2)
    .max(50)
});

/// §M28 opening balances: seed/refill ledger accounts with one balanced
/// `opening` transaction (Σ debits = Σ credits in the same posting). Financial
/// change → M28:update (Admin+) only; audited; forward-only (posted history
/// is never rewritten — a mistake is corrected by a reversing `adjustment`).
export async function POST(req: Request) {
  const ip = clientIp(req);
  const user = await getAuthUser();
  if (!user) return fail(401, "UNAUTHENTICATED", "Sign in required");
  if (!hasModuleAccess(user, "update", "M28")) return fail(403, "FORBIDDEN", "Missing permission M28:update");
  const parsed = await parseBody(req, bodySchema);
  if (parsed.response) return parsed.response;

  const sum = (dir: "debit" | "credit") => parsed.data.lines.filter((l) => l.direction === dir).reduce((s, l) => s + l.amountMinor, 0);
  if (sum("debit") !== sum("credit")) {
    return fail(400, "UNBALANCED", "Opening balances must balance: Σ debits must equal Σ credits");
  }

  const lines = parsed.data.lines.map((l) => ({
    code: l.code,
    debit: l.direction === "debit" ? l.amountMinor : 0,
    credit: l.direction === "credit" ? l.amountMinor : 0
  }));

  let txId: string;
  try {
    txId = await prisma.$transaction(async (tx) => postTransaction(tx, {
      memo: parsed.data.memo,
      refType: "opening",
      actorId: user.id,
      lines
    }));
  } catch (e) {
    return fail(400, "POSTING_FAILED", e instanceof Error ? e.message : "Opening balance posting failed");
  }
  // audit AFTER the posting commits (never inside $transaction)
  await logAudit({
    actorId: user.id,
    actorName: user.name,
    module: "M28",
    action: "create",
    entityType: "ledger_transaction",
    entityId: txId,
    summary: `Opening balances posted (${parsed.data.lines.length} lines, ${(sum("debit") / 100).toFixed(2)} total)`,
    after: { txId, lines },
    ip
  });
  return ok({ transactionId: txId });
}
