import { prisma } from "@/lib/db";
import { getAuthUser } from "@/lib/auth/session";
import { can, hasModuleAccess } from "@/lib/rbac/can";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { EmptyState, PageHeader } from "@/components/ui/misc";
import { formatMinor } from "@/lib/money";
import { RulesForm } from "./rules-form";
import { Tx } from "@/components/i18n-text";

export const dynamic = "force-dynamic";

export default async function RentEnginePage() {
  const user = await getAuthUser();
  if (!user || !hasModuleAccess(user, "read", "M06")) {
    return <EmptyState title="No access" hint="Your roles do not include read on the Rent Engine (M06)." />;
  }
  const canEdit = can(user, "update", "M06");

  const [lateFee, tax, dunning, generation, plans] = await Promise.all([
    prisma.lateFeeRule.findFirst({ where: { isActive: true } }),
    prisma.taxRule.findFirst({ where: { isActive: true, isDefault: true } }),
    prisma.setting.findUnique({ where: { key: "billing.dunning" } }),
    prisma.setting.findUnique({ where: { key: "billing.generation" } }),
    prisma.rentPlan.findMany({ where: { isActive: true }, orderBy: { name: "asc" } })
  ]);

  const schedule = dunning ? (JSON.parse(dunning.value) as { scheduleDays: number[] }).scheduleDays : [3, 7, 14];
  const leadDays = generation ? (JSON.parse(generation.value) as { leadDays: number }).leadDays : 3;

  return (
    <div>
      <PageHeader
        title="Rent Engine"
        description="Pure billing rules: proration, late fees, tax, dunning and the generation job (M06)"
      />

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Billing rules</CardTitle>
          </CardHeader>
          <CardContent>
            <RulesForm
              canEdit={canEdit}
              initial={{
                graceDays: lateFee?.graceDays ?? 3,
                lateFeeType: lateFee?.type ?? "FIXED",
                lateFeeAmount: ((lateFee?.amountMinor ?? 500) / 100).toString(),
                lateFeePercent: ((lateFee?.percentBps ?? 0) / 100).toString(),
                lateFeeCap: ((lateFee?.capMinor ?? 5000) / 100).toString(),
                taxPercent: ((tax?.percentBps ?? 0) / 100).toString(),
                generationLeadDays: leadDays
              }}
            />
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Rent plans (catalog)</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Plan</TableHead>
                    <TableHead className="text-right">Amount / mo</TableHead>
                    <TableHead className="text-right">Cycle day</TableHead>
                    <TableHead>Proration</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {plans.map((p) => (
                    <TableRow key={p.id}>
                      <TableCell className="font-medium">{p.name}</TableCell>
                      <TableCell className="text-right tabular-nums">{formatMinor(p.amountMinor)}</TableCell>
                      <TableCell className="text-right tabular-nums">{p.cycleDay}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{p.prorationBasis === "thirty_day" ? "30-day" : "calendar"}</Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                  {plans.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={4} className="py-6 text-center text-sm text-muted-foreground"><Tx>
                        No plans in the catalog — leases use their snapshotted terms.
                      </Tx></TableCell>
                    </TableRow>
                  ) : null}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">How billing works</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm text-muted-foreground">
              <p>
                <span className="font-medium text-foreground"><Tx>Generation</Tx></span> bills every active lease whose period has
                started (up to {leadDays} day(s) early). Mid-month move-ins produce a prorated stub invoice first, then full
                advance-monthly invoices. Re-runs are idempotent — one live invoice per lease per period.
              </p>
              <p>
                <span className="font-medium text-foreground"><Tx>Late fees</Tx></span> apply once per invoice after{" "}
                {lateFee?.graceDays ?? 3} day(s) past due. <span className="font-medium text-foreground"><Tx>Dunning</Tx></span>{" "}
                reminders fire on day {schedule.join(", day ")} past due (channels land with Telegram in Phase 19).
              </p>
              <p>
                <span className="font-medium text-foreground"><Tx>Invariants:</Tx></span> integer minor units · total = Σ items −
                discount + tax · issued invoices immutable (credit notes only) · gapless numbering per property-year.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
