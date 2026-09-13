# 12. Monitoring & logs


## Signals to watch

| Signal | How |
|---|---|
| App health | `GET /api/health` → 200 + DB `SELECT 1` (used by Docker healthcheck) |
| Backend health | `GET http://localhost:808x/actuator/health` per service; gateway aggregates |
| Audit integrity | `GET /api/audit/verify` → `{ ok: true }` |
| Books reconcile | collections/arrears report `summary.reconciles == "yes"` |
| Dashboards | Grafana http://localhost:9090 (provisioned per-service dashboards) |
| Container status | `docker compose ps` · `npm run docker:status` |
| Logs | `docker compose logs -f rentmanager` · `docker compose logs -f gateway` |
| Kafka | Kafka UI http://localhost:8090 |
| Files | MinIO console http://localhost:9001 |

Investigating a bad transaction: **Audit Log** → filter actor/date/entity →
compare before/after → trace linked invoice/ledger → correct with the proper
**reversal** (credit note / void / refund). Never hand-edit posted records.

---
