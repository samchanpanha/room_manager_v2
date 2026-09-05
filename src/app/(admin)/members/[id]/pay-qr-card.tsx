import { prisma } from "@/lib/db";
import { signMemberToken, memberPayQrDataUrl } from "@/lib/qrpay/tokens";
import { env } from "@/lib/env";
import { Card, CardContent } from "@/components/ui/card";
import { Tx } from "@/components/i18n-text";

/// M13: the member's scan-to-pay QR (poster/invoice insert). Encodes
/// {APP_BASE_URL}/pay?m=<HMAC token> — pay-without-login (§M13).
export async function MemberPayQrCard({ memberId }: { memberId: string }) {
  const openCount = await prisma.invoice.count({ where: { memberProfileId: memberId, status: { in: ["issued", "partial_paid", "overdue"] }, amountDueMinor: { gt: 0 } } });
  const token = signMemberToken(memberId);
  const dataUrl = await memberPayQrDataUrl(env.APP_BASE_URL, memberId);
  return (
    <Card className="mt-6">
      <CardContent className="flex items-center gap-5 p-5">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={dataUrl} alt="Member pay QR" className="h-32 w-32 rounded-lg border bg-white p-1.5" />
        <div className="text-sm">
          <p className="font-medium"><Tx>Scan-to-pay QR (M13)</Tx></p>
          <p className="mt-1 text-xs text-muted-foreground">
            <Tx>Print this on the door poster or invoice: scanning opens the pay-without-login page with the member&apos;s outstanding invoices.
            </Tx>{openCount > 0 ? ` Currently ${openCount} open invoice(s).` : " No open invoices right now."}
          </p>
          <p className="mt-1 break-all font-mono text-[10px] text-muted-foreground"><Tx>/pay?m=</Tx>{token.slice(0, 18)}…</p>
        </div>
      </CardContent>
    </Card>
  );
}
