import { z } from "zod";
import { fail, parseQuery } from "@/lib/api";
import { getAuthUser } from "@/lib/auth/session";
import { hasModuleAccess } from "@/lib/rbac/can";
import { toCsv } from "@/lib/csv";
import { runReport } from "@/lib/reports/service";
import { canSeeReport, reportScope } from "@/lib/reports/scope";
import { applyReportDesign, resolveReportKeys, summaryLabel } from "@/lib/reports/config";
import { getSettings } from "@/lib/settings";
import { getT } from "@/lib/locale-server";
import { ReportPdf } from "@/lib/reports/report-pdf";

/// Money summary keys carry minor units; spreadsheets want numbers in major
/// units, so exports convert them (the screen keeps the currency-formatted text).
function exportValue(k: string, v: unknown): string | number {
  if (typeof v === "number") return k.endsWith("Minor") ? v / 100 : v;
  return v == null ? "" : String(v);
}

const querySchema = z.object({
  format: z.enum(["csv", "pdf", "xlsx"]).default("csv"),
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

  // Optional org configuration applies to exports exactly as it does on screen:
  // develop/assign gating first, then the design (title/description/columns).
  const { reports: reportSettings } = await getSettings();
  if (!resolveReportKeys([key], reportSettings, user.id).includes(key)) {
    return fail(403, "FORBIDDEN", "This report is not enabled or assigned for your account");
  }
  const designed = applyReportDesign(result, reportSettings.designs[key]);
  // Labels follow the caller's language (en / km / zh). PDF stays English:
  // @react-pdf/renderer ships Helvetica, which cannot render Khmer or Chinese
  // glyphs — a localized PDF would come out as boxes.
  const { tUi } = await getT();
  const local = parsed.data.format === "pdf" ? (text: string) => text : tUi;
  const stamp = new Date().toISOString().slice(0, 10);

  if (parsed.data.format === "csv") {
    const header = designed.columns.map((c) => local(c.label));
    const rows = designed.rows.map((r) => designed.columns.map((c) => r[c.key]));
    for (const [k, v] of Object.entries(designed.summary)) rows.push([local(summaryLabel(k)), exportValue(k, v)]);
    return new Response(toCsv(header, rows), {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${key}-${stamp}.csv"`
      }
    });
  }

  if (parsed.data.format === "xlsx") {
    const { utils, write } = await import("xlsx");
    const header = designed.columns.map((c) => local(c.label));
    const body = designed.rows.map((r) => designed.columns.map((c) => r[c.key]));
    const summaryRows = Object.entries(designed.summary).map(([k, v]) => [local(summaryLabel(k)), exportValue(k, v)]);
    const sheet = utils.aoa_to_sheet([header, ...body, ...summaryRows]);
    try {
      sheet["!cols"] = designed.columns.map((c, _i) => ({
        wch: Math.max(10, local(c.label).length, ...designed.rows.map((r) => String(r[c.key] ?? "").length))
      }));
    } catch {
      // width hinting is best-effort
    }
    const wb = utils.book_new();
    utils.book_append_sheet(wb, sheet, key.slice(0, 31));
    const buffer = write(wb, { type: "buffer", bookType: "xlsx", compression: true }) as Buffer;
    return new Response(new Uint8Array(buffer), {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${key}-${stamp}.xlsx"`
      }
    });
  }

  const { renderToBuffer } = await import("@react-pdf/renderer");
  const summaryLines = Object.entries(result.summary).map(([k, v]) => `${k}: ${v ?? "—"}`);
  const buffer = await renderToBuffer(
    <ReportPdf
      data={{
        title: designed.title,
        source: designed.source,
        generatedAt: new Date().toISOString().replace("T", " ").slice(0, 16) + " UTC",
        period: designed.from || designed.to ? `${designed.from ?? "…"} → ${designed.to ?? "…"}` : `as of ${stamp}`,
        columns: designed.columns,
        rows: designed.rows,
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
