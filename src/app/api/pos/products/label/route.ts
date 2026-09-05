import { fail } from "@/lib/api";
import { getAuthUser } from "@/lib/auth/session";
import { can } from "@/lib/rbac/can";
import { prisma } from "@/lib/db";
import { ean13SvgDataUrl } from "@/lib/barcode";

/// Browser label printer: returns a print-ready HTML sheet of EAN-13 product
/// labels (one per product + copies, optionally filtered by category, or a
/// single product's own label). Style sheets target standard 58 mm x 40 mm
/// sticky labels on 210 x 297 mm stock via CSS @page + grid.
export async function GET(req: Request) {
  const user = await getAuthUser();
  if (!user) return fail(401, "UNAUTHENTICATED", "Sign in required");
  if (!can(user, "read", "M14")) return fail(403, "FORBIDDEN", "Missing permission M14:read");

  const url = new URL(req.url);
  const idsParam = url.searchParams.get("ids");
  const category = url.searchParams.get("category");
  const copies = Math.max(1, Math.min(12, Number(url.searchParams.get("copies") ?? 1) || 1));

  const ids = idsParam ? idsParam.split(",").filter(Boolean) : [];
  const where: Record<string, unknown> = { isActive: true };
  if (ids.length > 0) where.id = { in: ids };
  else if (category) where.category = category;

  const products = await prisma.posProduct.findMany({ where, orderBy: { name: "asc" } });
  if (products.length === 0) {
    return new Response("No products to print.", { status: 404, headers: { "Content-Type": "text/plain" } });
  }

  const createdAt = new Date().toISOString().slice(0, 16).replace("T", " ");
  const labels = products.flatMap((p) => {
    const svg = p.barcode ? ean13SvgDataUrl(p.barcode, { scale: 2, showText: true }) : null;
    return Array.from({ length: copies }, () => ({
      name: p.name,
      price: p.priceMinor,
      category: p.category,
      sku: p.sku,
      svg
    }));
  });

  const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<title>Barcode labels</title>
<style>
  @page { size: 210mm 297mm; margin: 5mm; }
  * { box-sizing: border-box; }
  body { font-family: -apple-system, "Segoe UI", Roboto, sans-serif; margin: 0; }
  .toolbar { display: flex; justify-content: space-between; align-items: center; padding: 8px 12px; border-bottom: 1px solid #eee; background: #fafafa; position: sticky; top: 0; z-index: 5; }
  .toolbar button, .toolbar a { font-size: 13px; padding: 6px 12px; border-radius: 6px; border: 1px solid #d1d5db; background: #fff; cursor: pointer; text-decoration: none; color: #111; }
  .grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 4px; padding: 6px; }
  .label { border: 1px dashed #cbd5e1; border-radius: 4px; padding: 4px; text-align: center; break-inside: avoid; }
  .label img { max-width: 100%; height: auto; }
  .name { font-size: 10px; font-weight: 600; text-overflow: ellipsis; overflow: hidden; white-space: nowrap; }
  .meta { font-size: 8px; color: #6b7280; }
  .price { font-size: 11px; font-weight: 700; }
  @media print { .toolbar { display: none; } .grid { gap: 2px; padding: 0; } .label { border: none; } }
</style>
</head>
<body>
  <div class="toolbar">
    <span>${labels.length} label(s) · ${createdAt} · ${products.length} product(s)${category ? ` · category "${category}"` : ""}</span>
    <span><button onclick="window.print()">Print</button> <a href="javascript:window.close()">Close</a></span>
  </div>
  <div class="grid">
    ${labels.map((l, ix) => `<div class="label" data-ix="${ix}">
      ${l.svg ? `<img src="${l.svg}" alt="" />` : `<div style="height:44px;display:flex;align-items:center;justify-content:center;color:#9ca3af;font-size:10px">no barcode</div>`}
      <div class="name">${escapeHtml(l.name)}</div>
      <div class="price">$${(l.price / 100).toFixed(2)}</div>
      ${l.category || l.sku ? `<div class="meta">${[l.category, l.sku ? `SKU ${l.sku}` : null].filter(Boolean).join(" · ")}</div>` : ""}
    </div>`).join("\n    ")}
  </div>
  <script>
    window.onload = function () {
      const params = new URLSearchParams(location.search);
      if (params.get("p") === "1") setTimeout(function () { window.print(); }, 400);
    };
  </script>
</body>
</html>`;

  return new Response(html, { headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" } });
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}