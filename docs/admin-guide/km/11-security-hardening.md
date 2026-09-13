# 11. បញ្ជីត្រួតពិនិត្យរឹតបន្តឹងសុវត្ថិភាព


## មុនពេលដាក់ប្រើផលិតកម្ម

មូលដ្ឋានមានក្នុង build រួចហើយ៖ scrypt passwords, DB revocable sessions,
httpOnly cookies, rate-limited login, TOTP 2FA (តម្រូវ Admin+), signed
login challenges, tamper-evident audit hash chain ជាមួយ PII masking, CSP +
security headers, sealed provider secrets, S3 signed URLs ជាមួយ short TTL។
(មើល `manual/09-security-guide.md` + `SECURITY.md`។)

មុន production, admin ត្រូវ៖

- [ ] ប្តូរ default secret **ទាំងអស់**៖ `FILE_SIGNING_SECRET`,
      `PAYMENT_WEBHOOK_SECRET`, `SETTINGS_ENC_KEY` (32+ random bytes),
      `TELEGRAM_WEBHOOK_SECRET`, DB password, Redis password,
      MinIO root password, Grafana admin, Nacos/Keycloak admins។
- [ ] បិទ ឬប្តូរពាក្យសម្ងាត់ **គណនី `*@demo.test` ទាំងអស់**፤ បង្កើត real
      admins፤ ចុះឈ្មោះ **2FA** សម្រាប់ Admin+ នីមួយៗ។
- [ ] កំណត់ `COOKIE_SECURE=true` និង serve **HTTPS តែប៉ុណ្ណោះ** (reverse proxy៖
      Caddy/Nginx/Traefik ជាមួយ TLS፤ `APP_BASE_URL` = public https URL)។
- [ ] Bind internal ports (5432, 6379, 8848, 7080, 9092, 9000…) ទៅ
      localhost ឬ private network — កុំ expose DB/Redis/Kafka ទៅ internet។
- [ ] ផ្ទៀងផ្ទាត់ **rate limits** លើ auth + webhooks፤ បញ្ជាក់ថា Telegram/Payment
      webhooks បដិសេធ signatures មិនត្រឹមត្រូវ (spoof test)។
- [ ] ដំណើរការ **Verify audit chain**፤ បញ្ជាក់ PII masking ក្នុង logs។
- [ ] កំណត់កាលវិភាគ **nightly backup** + offsite copy፤ test-restore ម្តងមុន go-live។
- [ ] កំណត់ retention policy፤ បញ្ជាក់ថា audit មិនរាប់ក្នុង purge។
- [ ] ពិនិត្យ **permission matrix** (§4.2) ធៀប org chart របស់អ្នក፤ លុប
      role grants ដែលមិនប្រើ (least privilege)។
- [ ] Penetration self-check៖ cross-property IDOR, privilege escalation,
      webhook spoofing, URL guessing, public `/pay` exact-due enforcement។

---
