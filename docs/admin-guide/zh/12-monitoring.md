# 12. 监控与日志


## 需要关注的信号

| 信号 | 方法 |
|---|---|
| 应用健康 | `GET /api/health` → 200 + DB `SELECT 1`（Docker 健康检查在用） |
| 后端健康 | 各服务 `GET http://localhost:808x/actuator/health`；网关聚合 |
| 审计完整性 | `GET /api/audit/verify` → `{ ok: true }` |
| 账实相符 | 对账/账龄报表 `summary.reconciles == "yes"` |
| 看板 | Grafana http://localhost:9090（预置各服务看板） |
| 容器状态 | `docker compose ps` · `npm run docker:status` |
| 日志 | `docker compose logs -f rentmanager` · `docker compose logs -f gateway` |
| Kafka | Kafka UI http://localhost:8090 |
| 文件 | MinIO 控制台 http://localhost:9001 |

调查一笔坏账：**Audit Log** → 按操作人/日期/实体筛选 →
 对比前后值 → 追踪关联发票/总账 → 用正确的**冲销**
 （credit note / void / refund）更正。切勿手工改已入账记录。

---
