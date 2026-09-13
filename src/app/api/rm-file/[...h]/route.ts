import { GET as invoicesPdf } from "@/app/api/invoices/[id]/pdf/route";
import { GET as paymentsReceipt } from "@/app/api/payments/[id]/receipt/route";
import { GET as leasesContract } from "@/app/api/leases/[id]/contract/route";
import { GET as statementsPdf } from "@/app/api/statements/[id]/pdf/route";
import { GET as reportsExport } from "@/app/api/reports/[key]/export/route";
import { GET as posSaleReceipt } from "@/app/api/pos/sales/[id]/receipt/route";
import { GET as posProductImage } from "@/app/api/pos/products/[id]/image/route";
import { GET as stayBookingReceipt } from "@/app/api/stay/bookings/[id]/receipt/route";
import { GET as serviceImage } from "@/app/api/services/[id]/image/route";
import { GET as stockItemImage } from "@/app/api/stock/items/[id]/image/route";

// §M13 QR / M09 payment lifecycle handlers (in-app) that live under migrated
// prefixes — see next.config.ts beforeFiles carve-outs.
import { POST as invoiceQr } from "@/app/api/invoices/[id]/qr/route";
import { POST as paymentsRecord } from "@/app/api/payments/route";
import { GET as paymentDetail } from "@/app/api/payments/[id]/route";
import { POST as paymentConfirm } from "@/app/api/payments/[id]/confirm/route";
import { POST as paymentFail } from "@/app/api/payments/[id]/fail/route";
import { POST as paymentRefund } from "@/app/api/payments/[id]/refund/route";
import { POST as qrpayDues } from "@/app/api/qrpay/dues/route";
import { POST as qrpayPay } from "@/app/api/qrpay/pay/route";
import { POST as qrpayPayAll } from "@/app/api/qrpay/pay-all/route";
import { POST as qrpayStatus } from "@/app/api/qrpay/status/route";
import { POST as portalPayAll } from "@/app/api/portal/pay-all/route";
import { POST as paymentsWebhook } from "@/app/api/webhooks/payments/route";

/// Internal dispatch namespace for subroutes shadowed by the gateway rewrites
/// (strangler-fig). next.config.ts `beforeFiles` rewrites rewrite e.g.
/// /api/invoices/:id/pdf → /api/rm-file/invoices/pdf/:id (GET file routes) and
/// the QR/payment lifecycle (POST) so the canonical in-app handlers stay
/// reachable even though their prefix is proxied to the Spring backend.
/// Browser-visible URLs are unchanged.
/// NOTE: must NOT start with `_` — underscore-prefixed folders are excluded
/// from the Next.js router.
async function dispatch(req: Request, segments: string[]): Promise<Response> {
  const ctx = <T extends string>(key: T) => ({ params: Promise.resolve({ [key]: segments[2] } as Record<T, string>) });

  // beforeFiles rewrites are method-agnostic, so a wrong-method request can
  // reach a carve-out (e.g. GET /api/payments → payments/record). Enforce the
  // handler's own contract instead of running a foreign body through it.
  const notAllowed = (allow: string) =>
    new Response("Method Not Allowed", { status: 405, headers: { Allow: allow } });

  if (segments.length === 3) {
    switch (`${segments[0]}/${segments[1]}`) {
      case "invoices/pdf": return req.method === "GET" ? invoicesPdf(req, ctx("id")) : notAllowed("GET");
      case "payments/receipt": return req.method === "GET" ? paymentsReceipt(req, ctx("id")) : notAllowed("GET");
      case "leases/contract": return req.method === "GET" ? leasesContract(req, ctx("id")) : notAllowed("GET");
      case "statements/pdf": return req.method === "GET" ? statementsPdf(req, ctx("id")) : notAllowed("GET");
      case "reports/export": return req.method === "GET" ? reportsExport(req, ctx("key")) : notAllowed("GET");
      case "pos/receipt": return req.method === "GET" ? posSaleReceipt(req, ctx("id")) : notAllowed("GET");
      case "pos/image": return req.method === "GET" ? posProductImage(req, ctx("id")) : notAllowed("GET");
      case "stay/receipt": return req.method === "GET" ? stayBookingReceipt(req, ctx("id")) : notAllowed("GET");
      case "services/image": return req.method === "GET" ? serviceImage(req, ctx("id")) : notAllowed("GET");
      case "stock-items/image": return req.method === "GET" ? stockItemImage(req, ctx("id")) : notAllowed("GET");

      // §M13 / M09 carve-outs (id in segment[2]) — POST-only lifecycle.
      case "invoices/qr": return req.method === "POST" ? invoiceQr(req, ctx("id")) : notAllowed("POST");
      case "payments/detail": return req.method === "GET" ? paymentDetail(req, ctx("id")) : notAllowed("GET");
      case "payments/confirm": return req.method === "POST" ? paymentConfirm(req, ctx("id")) : notAllowed("POST");
      case "payments/fail": return req.method === "POST" ? paymentFail(req, ctx("id")) : notAllowed("POST");
      case "payments/refund": return req.method === "POST" ? paymentRefund(req, ctx("id")) : notAllowed("POST");
    }
  }

  if (segments.length === 2) {
    switch (`${segments[0]}/${segments[1]}`) {
      // payments/record is the ONLY case with a legitimate GET twin (Spring's
      // list-by-member) — a GET hitting this must 405, not run the create body.
      case "payments/record": return req.method === "POST" ? paymentsRecord(req) : notAllowed("POST");
      case "qrpay/dues": return req.method === "POST" ? qrpayDues(req) : notAllowed("POST");
      case "qrpay/pay": return req.method === "POST" ? qrpayPay(req) : notAllowed("POST");
      case "qrpay/pay-all": return req.method === "POST" ? qrpayPayAll(req) : notAllowed("POST");
      case "qrpay/status": return req.method === "POST" ? qrpayStatus(req) : notAllowed("POST");
      case "portal/pay-all": return req.method === "POST" ? portalPayAll(req) : notAllowed("POST");
      case "webhooks/payments": return req.method === "POST" ? paymentsWebhook(req) : notAllowed("POST");
    }
  }

  return new Response("Not found", { status: 404 });
}

export function GET(req: Request, ctx: { params: Promise<{ h: string[] }> }) {
  return ctx.params.then(({ h: segments }) => dispatch(req, segments));
}

export function POST(req: Request, ctx: { params: Promise<{ h: string[] }> }) {
  return ctx.params.then(({ h: segments }) => dispatch(req, segments));
}