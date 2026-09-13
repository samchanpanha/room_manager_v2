import type { NextConfig } from "next";
import { BACKEND_ENABLED, BACKEND_ORIGIN, MIGRATED_PREFIXES } from "./src/lib/backend/config";

/// §M27 security headers. CSP frame-ancestors admits the sandbox preview host
/// (*.e2b.app) alongside same-origin; a production deploy should tighten this
/// to 'self' (and add HSTS + upgrade-insecure-requests at the TLS terminator).
const csp = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' 'unsafe-eval'", // Next dev + inline bootstrap; prod build can drop 'unsafe-eval'
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self' data:",
  "connect-src 'self'",
  "frame-ancestors 'self' https://*.e2b.app",
  "base-uri 'self'",
  "form-action 'self'"
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: csp },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=()" },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" }
];

const nextConfig: NextConfig = {
  // Deploy (§10 row 22): small CI/deploy boxes OOM in parallel static
  // generation — run the page-data phase single-threaded (negligible for a
  // ~30-page app; all data pages are force-dynamic anyway).
  experimental: {
    cpus: 1
  },
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
  // Frontend/backend split (strangler-fig): proxy migrated `/api/*` prefixes to
  // the Spring Boot backend; everything else stays on the in-app route handlers.
  // Same-origin from the browser's view, so the `rm_session` cookie flows without
  // CORS. Flip modules by editing `src/lib/backend/config.ts`.
  //
// `afterFiles` rewrites shadow DYNAMIC in-app file routes (e.g.
  // /api/invoices/:id/pdf), so the file subroutes under migrated prefixes are
  // intercepted by `beforeFiles` (highest priority) and rewritten to an internal
  // `/api/rm-file/*` namespace where the in-app handlers keep serving them — see
  // src/app/api/rm-file/[...h]/route.ts. Static in-app routes (e.g.
  // /api/attendance/export) already win over afterFiles on their own.
  async rewrites() {
    if (!BACKEND_ENABLED) return [];
    const beforeFiles = [
      { source: "/api/invoices/:id/pdf", destination: "/api/rm-file/invoices/pdf/:id" },
      { source: "/api/payments/:id/receipt", destination: "/api/rm-file/payments/receipt/:id" },
      { source: "/api/leases/:id/contract", destination: "/api/rm-file/leases/contract/:id" },
      { source: "/api/statements/:id/pdf", destination: "/api/rm-file/statements/pdf/:id" },
      { source: "/api/reports/:key/export", destination: "/api/rm-file/reports/export/:key" },
      { source: "/api/pos/sales/:id/receipt", destination: "/api/rm-file/pos/receipt/:id" },
      { source: "/api/pos/products/:id/image", destination: "/api/rm-file/pos/image/:id" },
      { source: "/api/stay/bookings/:id/receipt", destination: "/api/rm-file/stay/receipt/:id" },
      { source: "/api/services/:id/image", destination: "/api/rm-file/services/image/:id" },
      { source: "/api/stock/items/:id/image", destination: "/api/rm-file/stock-items/image/:id" },

      // §M13 QR payment lifecycle (in-app only — the Spring billing-service has
      // no QR routes, so shadowing these returns 404; carve them back to the
      // in-app handlers).
      { source: "/api/invoices/:id/qr", destination: "/api/rm-file/invoices/qr/:id" },
      // Manual record (created pending) then confirm/fail/refund + detail polling.
      { source: "/api/payments", destination: "/api/rm-file/payments/record" },
      { source: "/api/payments/:id", destination: "/api/rm-file/payments/detail/:id" },
      { source: "/api/payments/:id/confirm", destination: "/api/rm-file/payments/confirm/:id" },
      { source: "/api/payments/:id/fail", destination: "/api/rm-file/payments/fail/:id" },
      { source: "/api/payments/:id/refund", destination: "/api/rm-file/payments/refund/:id" },
      { source: "/api/qrpay/dues", destination: "/api/rm-file/qrpay/dues" },
      { source: "/api/qrpay/pay", destination: "/api/rm-file/qrpay/pay" },
      { source: "/api/qrpay/pay-all", destination: "/api/rm-file/qrpay/pay-all" },
      { source: "/api/qrpay/status", destination: "/api/rm-file/qrpay/status" },
      { source: "/api/portal/pay-all", destination: "/api/rm-file/portal/pay-all" },
      { source: "/api/webhooks/payments", destination: "/api/rm-file/webhooks/payments" }
    ];
    const afterFiles = MIGRATED_PREFIXES.flatMap((prefix) => [
      { source: prefix, destination: `${BACKEND_ORIGIN}${prefix}` },
      { source: `${prefix}/:path*`, destination: `${BACKEND_ORIGIN}${prefix}/:path*` }
    ]);
    return { beforeFiles, afterFiles, fallback: [] };
  }
};

export default nextConfig;
