import { z } from "zod";
import { fail, parseQuery } from "@/lib/api";
import { getAuthUser } from "@/lib/auth/session";
import { hasModuleAccess } from "@/lib/rbac/can";
import { toCsv } from "@/lib/csv";
import { runReport } from "@/lib/reports/service";
import { canSeeReport, reportScope } from "@/lib/reports/scope";
import { ReportPdf } from "@/lib/reports/report-pdf";

const querySchema = z.object({
  format: z.enum(["csv", "pdf"]).default("csv"),
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  month: z.string().regex(/^\d{4}-\d{2}$/).optional(),
  propertyId: z.string().min(1).optional()
});

/// §M26 "CSV/PDF export" — same scoped data as the JSON route.
export async function GET(req: Request, ctx: { params: Promise<{ key: string }> }) {
  const { key } = await ctx.params;
  const parsed = parseQuery(req, querySchema);
  if (parsed.response || !parsed.data) return parsed.response ?? fail(400, "VALIDATION_ERROR", "Invalid query");

  const user = await getAuthUser();
  if (!user) return fail(401, "UNAUTHENTICATED", "Sign in required");
  if (!hasModuleAccess(user, "read", "M26")) return fail(403, "FORBIDDEN", "Missing permission M26:read");
  if (!canSeeReport(user, key)) return fail(403, "FORBIDDEN", "This report is outside your M26 grant");

  const scope = await reportScope(user);
  if (!scope.allowed) return fail(403, "FORBIDDEN", "No reporting scope");

  const result = await runReport(key, parsed.data, scope);
  if (!result) return fail(404, "NOT_FOUND", "Unknown report");
  const stamp = new Date().toISOString().slice(0, 10);

  if (parsed.data.format === "csv") {
    const header = result.columns.map((c) => c.label);
    const rows = result.rows.map((r) => result.columns.map((c) => r[c.key]));
    for (const [k, v] of Object.entries(result.summary)) rows.push([k, v]);
    return new Response(toCsv(header, rows), {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${key}-${stamp}.csv"`
      }
    });
  }

  const { renderToBuffer } = await import("@react-pdf/renderer");
  const summaryLines = Object.entries(result.summary).map(([k, v]) => `${k}: ${v ?? "—"}`);
  const buffer = await renderToBuffer(
    <ReportPdf
      data={{
        title: result.title,
        source: result.source,
        generatedAt: new Date().toISOString().replace("T", " ").slice(0, 16) + " UTC",
        period: result.from || result.to ? `${result.from ?? "…"} → ${result.to ?? "…"}` : `as of ${stamp}`,
        columns: result.columns,
        rows: result.rows,
        summaryLines
      }}
    />
  );
  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${key}-${stamp}.pdf"`
    }
  });
}
