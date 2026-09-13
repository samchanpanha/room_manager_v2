# 11. Security hardening checklist


## Before production

Baseline already in the build: scrypt passwords, DB revocable sessions,
httpOnly cookies, rate-limited login, TOTP 2FA (mandatory Admin+), signed
login challenges, tamper-evident audit hash chain with PII masking, CSP +
security headers, sealed provider secrets, S3 signed URLs with short TTL.
(see `manual/09-security-guide.md` + `SECURITY.md`.)

Before production, an admin must:

- [ ] Change **every** default secret: `FILE_SIGNING_SECRET`,
      `PAYMENT_WEBHOOK_SECRET`, `SETTINGS_ENC_KEY` (32+ random bytes),
      `TELEGRAM_WEBHOOK_SECRET`, DB password, Redis password,
      MinIO root password, Grafana admin, Nacos/Keycloak admins.
- [ ] Disable or re-password **all `*@demo.test` accounts**; create real
      admins; enroll **2FA** for every Admin+.
- [ ] Set `COOKIE_SECURE=true` and serve **HTTPS only** (reverse proxy:
      Caddy/Nginx/Traefik with TLS; `APP_BASE_URL` = public https URL).
- [ ] Bind internal ports (5432, 6379, 8848, 7080, 9092, 9000…) to
      localhost or a private network — never expose DB/Redis/Kafka to the internet.
- [ ] Verify **rate limits** on auth + webhooks; confirm Telegram/Payment
      webhooks reject bad signatures (spoof test).
- [ ] Run **Verify audit chain**; confirm PII masking in logs.
- [ ] Schedule **nightly backup** + offsite copy; test-restore once before go-live.
- [ ] Set **retention** policy; confirm audit is excluded from purge.
- [ ] Review the **permission matrix** (§4.2) against your org chart; remove
      unused role grants (least privilege).
- [ ] Penetration self-check: cross-property IDOR, privilege escalation,
      webhook spoofing, URL guessing, public `/pay` exact-due enforcement.

---
