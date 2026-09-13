# 2. 系统架构与服务

## 2.1 组件

```
                    ┌──────────────────────────────┐
                    │  Browser: staff / portal     │
                    └──────────────┬───────────────┘
                                   ▼
                    ┌──────────────────────────────┐
  :3000             │  rentmanager (Next.js 15)    │  ← 主应用，全部 UI + API
                    │  Prisma → PostgreSQL         │
                    └──────┬───────────────┬───────┘
                           │               │ /api/* (migrated prefixes)
                           ▼               ▼
                    ┌────────────┐  ┌──────────────────────┐
                    │ PostgreSQL │  │ gateway :8080        │  ← Spring Cloud
                    │ :5432      │  │ 8 Spring Boot svcs   │
                    └────────────┘  │ :8081–:8088          │
                           ┌────────┴──────────────────────┤
                           │ Nacos :8848 · Keycloak :7080  │
                           │ Kafka :9092 · Redis :6379    │
                           │ MinIO :9000/:9001 (files)    │
                           │ Grafana :9090 · Kafka UI     │
                           └───────────────────────────────┘
```

## 2.2 完整端口表（默认 `docker-compose.yml`）

| 服务 | URL | 登录（默认值 — 投产前请修改！） |
|---|---|---|
| **App（Next.js）** | http://localhost:3000 | 下方演示账号（§3） |
| API Gateway | http://localhost:8080 | — |
| Swagger（全部 API） | http://localhost:8080/swagger-ui.html | — |
| Identity :8081 · Property :8082 · Billing :8083 · Ops :8084 · Staff :8085 · Commerce :8086 · Notification :8087 · Report :8088 | `http://localhost:808x/actuator/health` | — |
| Nacos 控制台 | http://localhost:8848/nacos | `nacos` / `nacos` |
| Keycloak 管理 | http://localhost:7080 | `admin` / `admin` |
| Kafka UI | http://localhost:8090 | — |
| MinIO 控制台（文件） | http://localhost:9001 | `rentmanager` / `rentmanager-s3-secret` |
| Grafana 看板 | http://localhost:9090 | `admin` / `admin` |
| PostgreSQL | `localhost:5432` | `rentmanager` / `rentmanager` |
| Redis | `localhost:6379` | 密码 `rentmanager-redis-secret` |

> compose 文件通过环境变量设置 demo/dev 密钥（均有 `:-default` 回退）。
> 除本机演示外，请覆盖**每一个**密钥 — 见 §11。

## 2.3 数据存放在哪里

| 数据 | 位置 |
|---|---|
| 全部业务数据 | PostgreSQL（`rentmanager` 库）。迁移为**仅追加**；快照永远可以向前迁移。 |
| 文档/收据/PDF | S3 兼容对象存储（Docker 中为 MinIO；设置 `S3_*` 环境变量后可用任意 S3；否则为本地磁盘）。投产后请**单独备份存储桶**。 |
| 数据库备份 | 容器内 `/app/backups` → Docker 卷 `rentmanager-backups`（宿主机路径由 Docker 管理）。 |
| 会话 | 数据库存储、可撤销、httpOnly Cookie（`SESSION_TTL_DAYS`，默认 30）。 |
| 密封密钥 | 设置 → Providers 的密钥经 AES-256-GCM 加密（`SETTINGS_ENC_KEY`）；环境变量为回退。 |

---
