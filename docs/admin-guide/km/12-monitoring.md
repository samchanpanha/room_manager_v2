# 12. ការត្រួតពិនិត្យ និង logs


## សញ្ញាត្រូវតាមដាន

| សញ្ញា | របៀប |
|---|---|
| App health | `GET /api/health` → 200 + DB `SELECT 1` (ប្រើដោយ Docker healthcheck) |
| Backend health | `GET http://localhost:808x/actuator/health` តាម service፤ gateway aggregates |
| Audit integrity | `GET /api/audit/verify` → `{ ok: true }` |
| Books reconcile | របាយការណ៍ collections/arrears `summary.reconciles == "yes"` |
| Dashboards | Grafana http://localhost:9090 (provisioned per-service dashboards) |
| Container status | `docker compose ps` · `npm run docker:status` |
| Logs | `docker compose logs -f rentmanager` · `docker compose logs -f gateway` |
| Kafka | Kafka UI http://localhost:8090 |
| Files | MinIO console http://localhost:9001 |

ស៊ើបអង្កេតប្រតិបត្តិការខុស៖ **Audit Log** → filter actor/date/entity →
ប្រៀបធៀប before/after → trace invoice/ledger ដែលភ្ជាប់ → កែជាមួយ
**reversal** ត្រឹមត្រូវ (credit note / void / refund)។ កុំកែ records
ដែលបាន post ដោយដៃ។

---
