# 2. System architecture & services

## 2.1 Components

```
                    ┌──────────────────────────────┐
                    │  Browser: staff / portal     │
                    └──────────────┬───────────────┘
                                   ▼
                    ┌──────────────────────────────┐
  :3000             │  rentmanager (Next.js 15)    │  ← main app, all UI + APIs
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

## 2.2 Full port map (default `docker-compose.yml`)

| Service | URL | Login (defaults — change in prod!) |
|---|---|---|
| **App (Next.js)** | http://localhost:3000 | demo accounts below (§3) |
| API Gateway | http://localhost:8080 | — |
| Swagger (all APIs) | http://localhost:8080/swagger-ui.html | — |
| Identity :8081 · Property :8082 · Billing :8083 · Ops :8084 · Staff :8085 · Commerce :8086 · Notification :8087 · Report :8088 | `http://localhost:808x/actuator/health` | — |
| Nacos console | http://localhost:8848/nacos | `nacos` / `nacos` |
| Keycloak admin | http://localhost:7080 | `admin` / `admin` |
| Kafka UI | http://localhost:8090 | — |
| MinIO console (files) | http://localhost:9001 | `rentmanager` / `rentmanager-s3-secret` |
| Grafana dashboards | http://localhost:9090 | `admin` / `admin` |
| PostgreSQL | `localhost:5432` | `rentmanager` / `rentmanager` |
| Redis | `localhost:6379` | password `rentmanager-redis-secret` |

> The compose file sets demo/dev secrets via environment with `-default`
> fallbacks. For anything beyond a local demo, override **every** secret —
> see §11.

## 2.3 Where data lives

| Data | Location |
|---|---|
| All business data | PostgreSQL (`rentmanager` DB). Migrations are **additive-only**; snapshots can always be migrated forward. |
| Documents/receipts/PDFs | S3-compatible storage (MinIO in Docker; any S3 when `S3_*` env is set; local disk otherwise). **Back up the bucket separately** in production. |
| DB backups | `/app/backups` in the container → `rentmanager-backups` Docker volume (host path managed by Docker). |
| Sessions | DB-backed, revocable, httpOnly cookies (`SESSION_TTL_DAYS`, default 30). |
| Sealed secrets | Settings → Providers secrets are AES-256-GCM encrypted (`SETTINGS_ENC_KEY`); env vars act as fallback. |

---
