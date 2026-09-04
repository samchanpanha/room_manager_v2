import type { NextConfig } from "next";

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
  }
};

export default nextConfig;
