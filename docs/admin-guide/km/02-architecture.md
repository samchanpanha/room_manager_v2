# 2. ស្ថាបត្យកម្មប្រព័ន្ធ និងសេវា

## 2.1 សមាសធាតុ

```
                    ┌──────────────────────────────┐
                    │  Browser: staff / portal     │
                    └──────────────┬───────────────┘
                                   ▼
                    ┌──────────────────────────────┐
  :3000             │  rentmanager (Next.js 15)    │  ← app មេ, UI + APIs ទាំងអស់
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

## 2.2 ផែនទី port ពេញលេញ (លំនាំដើម `docker-compose.yml`)

| សេវា | URL | Login (លំនាំដើម — ប្តូរក្នុង prod!) |
|---|---|---|
| **App (Next.js)** | http://localhost:3000 | គណនីសាកល្បងខាងក្រោម (§3) |
| API Gateway | http://localhost:8080 | — |
| Swagger (APIs ទាំងអស់) | http://localhost:8080/swagger-ui.html | — |
| Identity :8081 · Property :8082 · Billing :8083 · Ops :8084 · Staff :8085 · Commerce :8086 · Notification :8087 · Report :8088 | `http://localhost:808x/actuator/health` | — |
| Nacos console | http://localhost:8848/nacos | `nacos` / `nacos` |
| Keycloak admin | http://localhost:7080 | `admin` / `admin` |
| Kafka UI | http://localhost:8090 | — |
| MinIO console (files) | http://localhost:9001 | `rentmanager` / `rentmanager-s3-secret` |
| Grafana dashboards | http://localhost:9090 | `admin` / `admin` |
| PostgreSQL | `localhost:5432` | `rentmanager` / `rentmanager` |
| Redis | `localhost:6379` | ពាក្យសម្ងាត់ `rentmanager-redis-secret` |

> ឯកសារ compose កំណត់ secrets សម្រាប់ demo/dev តាម environment ជាមួយ fallback
> `-default`។ សម្រាប់ការប្រើប្រាស់លើសពី demo ក្នុងម៉ាស៊ីន សូមប្តូរ secret
> **ទាំងអស់** — មើល §11។

## 2.3 ទិន្នន័យនៅទីណា

| ទិន្នន័យ | ទីតាំង |
|---|---|
| ទិន្នន័យអាជីវកម្មទាំងអស់ | PostgreSQL (DB `rentmanager`)។ Migrations ជា **additive-only**፤ snapshots អាច migrate ទៅមុខជានិច្ច។ |
| ឯកសារ/បង្កាន់ដៃ/PDF | Object storage អនុលោម S3 (MinIO ក្នុង Docker፤ S3 ណាក៏បានពេលកំណត់ `S3_*` env፤ ថាសក្នុងម៉ាស៊ីនបើមិនដូច្នោះ)។ **បម្រុងទុក bucket ដាច់ដោយឡែក** ក្នុង production។ |
| ការបម្រុងទុក DB | `/app/backups` ក្នុង container → Docker volume `rentmanager-backups` (ផ្លូវ host គ្រប់គ្រងដោយ Docker)។ |
| Sessions | ក្នុង DB, អាច revoke បាន, httpOnly cookies (`SESSION_TTL_DAYS` លំនាំដើម 30)។ |
| Secrets ដែលបានបិទ | Settings → Providers secrets ត្រូវបានអ៊ិនគ្រីប AES-256-GCM (`SETTINGS_ENC_KEY`)፤ env vars ជា fallback។ |

---
