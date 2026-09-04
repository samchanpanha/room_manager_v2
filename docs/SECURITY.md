# Security Checklist (M27) — Penetration Pass

Status: **pass — full systematic sweep** (2026-09-04). Re-run this list
before any release (Phase 22).

## 0. Full sweep (this pass)

- **480 API probes**: 81 static routes × 6 roles (anon, MEMBER, OWNER, STAFF,
  PROPERTY_MANAGER, ACCOUNTANT) against the §5 matrix — **0 leaks** (no 200
  for an ungranted module), 0 authenticated-401 anomalies.
- **174 page probes**: 29 admin pages × 6 personas — every non-granted hit is
  a hard redirect (307) or a data-free "No access" EmptyState; anon always
  redirects. `/owner-contracts` has no page (404 = route does not exist).
- **IDOR across properties** (PM is BLR-only): `reports/occupancy|rent-roll
  ?propertyId=RV` → 200 with **empty rows** (out-of-scope degrades to an
  empty set, never RV data); `/api/invoices` → BLR codes only; member
  `/api/invoices` → own invoices only; cross-property member GET → no data
  endpoint (405) / scope-denied.
- **Privilege escalation**: PM/ACC/MEMBER `POST /users` → **403 M01:create**;
  `settings/secrets`, `settings/opening-balances`, `jobs/retention`,
  `jobs/backup`, `auth/2fa/admin-reset`, `telegram/admin-link` → 403; member
  cross-user session list/revoke → 403 (own-scope sessions by design,
  §15 v1.4c); member payment for another member → 403 (M09 own-scope).
  Note: `parseBody` runs before `authorize()` on some routes, so an invalid
  body can surface 400 before the 403 — the guard still gates every
  read/write; ordering is a codebase convention, not a bypass.
- **Webhook spoofing**: wrong secret → 401 (both webhooks); valid-secret
  replay of an already-confirmed payment → `{ignored:true}` (idempotent,
  no double posting); bogus Telegram update with valid secret → 200-safe.
- **Rate limiting**: 11 rapid logins → 401×10 then **429**.
- **TOTP gate**: un-enrolled ADMIN → module APIs 403 (M26 read 403) while
  `auth/2fa/setup` stays 200; login returns `totpEnrollmentRequired`.
- **Bug found & fixed during the sweep**: seed ran `seedUsers()` (which links
  `propertyCodes` → `UserPropertyAssignment`) *before* `seedProperties()`, so
  on every fresh DB, PROPERTY-scoped roles (PM/STAFF) silently had no
  property scope — PM/STAFF `/api/reports` returned 403 "No reporting scope".
  Fixed by seeding properties first (idempotent); verified on a fresh
  `migrate reset + seed` (assignments now present) and PM/STAFF reports
  return 200 scoped to their properties.
- **Deliberate fail-closed tightenings** (documented, not leaks): ledger
  routes require GLOBAL M08:read (org-wide GL; MEMBER/OWNER use own-statement
  endpoints); M20 expense list/P&L behind the Accountant+ scope resolver
  (§M20); M14/M15 list guards use bare `can()` (PROPERTY grants need a
  resource → fail closed for lists); `W` letters carry no read.

## 1. IDOR across properties (standing probes)

- **Enforcement**: every read is scoped by `reportScope`/`can(user, action,
  module, resource)` — PROPERTY-scoped grants require the resource's property
  to be in the user's assignments (§5 `can()` is the single resolver).
- **Evidence**: `tests/rbac.test.ts` (12 RBDC negatives), M26 suite
  (`tests/reports-service.test.ts` — out-of-scope propertyId degrades to an
  empty result set), live: PM restricted to BLR sees no OP-property rows.
- **Probe**: PM session requests another property's invoice/report → empty or
  403, never cross-property data.

## 2. Privilege escalation

- **Enforcement**: permissions are role-granted in the DB (no client input
  ever selects permissions); `can()`/`hasModuleAccess()` gate every module
  route; ownership changes require Admin+ (M01:M).
- **2FA gate**: Admin+ users with un-enrolled TOTP hold **no** module
  capability except M27 (`totpEnrollmentRequired` gate in `can()`,
  §15 v1.4a) — live: un-enrolled root → `GET /api/reports` 403.
- **Secret settings**: `M28:update` is Admin-only — live: PM `PATCH
  /api/settings` → 403, `POST /api/jobs/backup` → 403.
- **Evidence**: `tests/security-settings.test.ts` (enrollment gate), matrix
  snapshot `tests/matrix.test.ts` (7) pins the §5 table in CI.

## 3. Webhook spoofing

- **Telegram**: `X-Telegram-Bot-Api-Secret-Token` verified timing-safe;
  mismatch → 401 (§M21 acceptance; `tests/telegram-service.test.ts`).
- **Payments gateway**: `x-webhook-secret` compared against the sealed DB
  secret (M28) falling back to `PAYMENT_WEBHOOK_SECRET`; mismatch → 401
  (`tests/qrpay.test.ts` + live smoke). Replays are idempotent (200, ignored).
- **Rate limiting** (new in M27): both webhooks 60/min/IP → 429; auth
  endpoints 5–10/min (login, login/verify, 2FA, portal OTP request/verify).

## 4. URL guessing / forced browsing

- **Enforcement**: every admin page calls `getAuthUser()` → `redirect`/`403`
  on missing module access; APIs fail closed (`FORBIDDEN Mxx:read`).
- **Live**: MEMBER session → `/settings`, `/settings/security` → 307 →
  `/dashboard`; `/api/settings` → 403; unauthenticated `/api/reports` → 401.
- 2FA challenge login cannot be bypassed by URL crafting: sessions are only
  minted inside `/api/auth/login[/verify]` after password+TOTP.

## 5. Hardening inventory (this phase)

| Control | Where |
|---|---|
| TOTP 2FA (RFC-6238, ±1 window), mandatory for Admin+ | `src/lib/auth/totp.ts`, `/api/auth/2fa/*`, `/settings/security` |
| Signed 5-min login challenges | `src/lib/auth/challenge.ts` |
| Sessions & devices list + revoke (own + Admin+) | `/api/auth/sessions`, `/settings/security` |
| Tamper-evident audit chain (mutation → brokenAtId; deletion → gaps) | `src/lib/audit.ts`, `GET /api/audit/verify` |
| PII masking in audit payloads | `logAudit()` maskText/SENSITIVE_KEYS |
| CSP + nosniff + Referrer-Policy + Permissions-Policy | `next.config.ts` headers |
| Rate limiting on auth + webhooks | `src/lib/ratelimit.ts` call-sites |
| Secrets: env-only defaults, AES-256-GCM-sealed DB overrides, masked reads | `src/lib/crypto/sealed.ts`, `/api/settings/secrets` |
| Short-TTL signed URLs (120 s) unchanged flow, S3 driver optional | `src/lib/storage/*` |
| Nightly backup + restore runbook | `POST /api/jobs/backup`, `docs/BACKUP.md` |
| Retention purge (audit never purged) | `POST /api/jobs/retention`, `src/lib/retention.ts` |

## Known limits (documented, accepted for v1)

- Rate limiter is in-memory/per-process — a multi-replica deploy moves it to
  shared store (Phase 22 note).
- CSP allows `'unsafe-inline'/'unsafe-eval'` for the Next dev runtime; the
  production build should drop `'unsafe-eval'` and serve nonces.
- `frame-ancestors` admits `*.e2b.app` for the sandbox preview; production
  sets `'self'` only (+ HSTS at the TLS terminator).
- TOTP replay within the 30 s step is not burn-listed (single-tenant dev
  risk accepted; login endpoint is rate-limited 10/min/IP).
