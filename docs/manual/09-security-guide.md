# Part 9 — Security Guide

For administrators, IT and anyone responsible for keeping the system safe. It
covers authentication, permissions, sessions, secrets, data access, audit and
secure operating practices. The system's own security notes live in
[`docs/SECURITY.md`](../SECURITY.md).

---

## 9.1 Authentication security

| Control | How it works |
|---|---|
| **Password storage** | Passwords are hashed with **scrypt** (never stored in plain text). |
| **Sessions** | DB-backed, **revocable** sessions; the cookie is **httpOnly** and **SameSite**. Sessions expire after `SESSION_TTL_DAYS`. |
| **Login rate limiting** | Login is rate-limited (**10 attempts / minute / IP**) to slow brute force. |
| **Forced password change** | Admin-created/reset accounts have `mustChangePassword` and must set a new password on first sign-in (other sessions then revoked). |
| **2FA (TOTP)** | **Mandatory for Admin and Super Admin.** QR enrollment via an authenticator app; codes verified with a clock-skew window; an admin can **reset** 2FA for a locked-out user. Admins **cannot use other modules until enrolled**. |
| **Member portal login** | Members use a **one-time password (OTP)** sent to email/phone — codes are **hashed, single-use**, and **lock after 5 attempts** (then request a new one). Logging in creates their MEMBER user. |
| **Kiosk PIN** | Attendance kiosk uses a **scrypt-hashed PIN** for clock in/out without a browser session. |

### Recommendation
- Turn on 2FA for **every** privileged account (Admin+ is required; encourage it for managers/accountants).
- Use the **temporary password → forced change** flow for new staff; never share a permanent password.
- Rotate passwords after any suspected compromise and revoke sessions.

---

## 9.2 Authorisation (permissions) security

- **RBDC on every endpoint:** `can(user, action, module, resource?)` runs
  server-side on every API route. UI hiding is convenience only.
- **Scoping prevents cross-property access:** PROPERTY-scoped roles
  (Manager/Staff) only reach their assigned properties; OWN-scoped roles
  (Owner/Member) only reach their own records. Cross-property/cross-owner access
  returns **403** (verified by negative tests, including IDOR attempts).
- **Privilege separation:** Staff cannot void invoices, change roles, or open
  ledger config; only Super Admin voids invoices; only Accountant+ approve
  refunds/statements; role/permission changes require M01.
- The permission matrix is **locked by CI snapshot/negative tests** so accidental
  privilege widening is caught.

### Secure practices
- Follow **least privilege**: grant the smallest role/scope that does the job
  (e.g. a "Cashier" role with only payments write).
- Assign **properties deliberately** to PROPERTY-scoped users.
- Review roles periodically; **delete/disable unused roles and users**. A role in
  use can't be deleted — remove members from it first.
- Remember effective permissions are the **union** of a user's roles.

---

## 9.3 Sessions & devices
- Users can view their **sessions & devices** (device/IP, created/expiry) in
  **My Account / Security** and **revoke** any session.
- Admins can revoke sessions for users; changing a password revokes other sessions.
- Sessions auto-expire; the **retention** job purges expired sessions per settings.

---

## 9.4 Data & file security
- **File storage:** documents go to private storage (S3-compatible driver
  selected by environment); downloads use **short-TTL (120s) HMAC-signed URLs**.
  You cannot access a file by guessing its path, and cross-property access is denied.
- **Secrets:** payment credentials and the Telegram bot token are **sealed with
  AES-256-GCM** before storage and only ever displayed **masked**; environment
  variables are the fallback. Secrets live in env/secret storage, never in code or chat.
- **PII masking:** personal data is masked inside audit logs.
- **Encryption key:** sealed secrets require `SETTINGS_ENC_KEY` — protect and back
  this key up out-of-band; without it sealed secrets cannot be opened.

---

## 9.5 Application hardening
- **Security headers / CSP** are applied; rate limiting also covers webhooks.
- **Webhook integrity:**
  - Payment webhooks require a **signed secret** (`x-webhook-secret`) and use
    **unique gateway references + idempotency keys**, so duplicate/forged
    notifications are rejected and a payment is confirmed **exactly once**.
  - The Telegram webhook **verifies signatures** — spoofed updates are rejected.
- **Member QR / public pay page:** `/pay` is **rate-limited**, allows **exact-due
  only**, requires no login, and uses **HMAC-signed** member tokens.

### Penetration checklist (from the security acceptance)
The system is built to pass: IDOR across properties (403), privilege escalation
(role gating), webhook spoofing (signature rejects), and URL guessing on files
(signed URL only).

---

## 9.6 Audit & accountability
- **Every mutation is audited** with actor, time, before/after and IP.
- The audit log is **append-only with a tamper-evident hash chain**; an admin can
  **verify the chain** (`/api/audit/verify`, under Security).
- **Audit history is never purged** by the retention job.
- Use the audit log to investigate disputes, correct transactions (via proper
  reversals), and demonstrate accountability.

---

## 9.7 Backups & availability
- **Nightly backup job** snapshots the database (newest **7** kept); restore
  runbook: [`docs/BACKUP.md`](../BACKUP.md).
- Production target database is **PostgreSQL** (dev uses SQLite); migrations are
  **additive only** and never destructive.

### Admin security checklist (go-live)
- [ ] Change/disable all demo accounts (`root@demo.test`, etc.) and the `Demo1234!` password.
- [ ] Enforce 2FA for Admin+ (it's required); confirm enrollment.
- [ ] Set a strong `SETTINGS_ENC_KEY` and store it safely; set all env secrets.
- [ ] Review users/roles; apply least privilege; assign properties correctly.
- [ ] Verify the audit chain; confirm audit logging is on.
- [ ] Confirm backups are running and test a restore.
- [ ] Set rate limits/headers; confirm webhook secrets for payments & Telegram.
- [ ] Set retention periods and confirm audit logs are excluded from purge.
