# RentManager — Spring Boot Microservices Backend

This directory contains the multi-module Maven project for the RentManager microservices architecture.

## Module Map

| Module | Port | Modules Covered | Status |
|---|---|---|---|
| `common` | — | Shared DTOs, Kafka envelope, RBDC types | ✅ Built |
| `gateway` | 8080 | Spring Cloud Gateway — routing, JWT, RBDC headers | ✅ Built |
| `identity-service` | 8081 | M00 M01 M02 M03 M27 M28 | ✅ Migrated from Slice 1 |
| `property-service` | 8082 | M04 M11 M12 M32 | 🔧 Scaffold |
| `billing-service` | 8083 | M05 M06 M07 M08 M09 M10 M13 | 🔧 Scaffold |
| `ops-service` | 8084 | M16 M18 M19 M22 | 🔧 Scaffold |
| `staff-service` | 8085 | M20 M23 M24 | 🔧 Scaffold |
| `commerce-service` | 8086 | M14 M15 | 🔧 Scaffold |
| `notification-service` | 8087 | M21 M25 | 🔧 Scaffold |
| `report-service` | 8088 | M26 | 🔧 Scaffold |

## Prerequisites

Start the infrastructure stack first:

```bash
docker compose -f ../deploy/docker-compose.infra.yml up -d
# Nacos    → http://localhost:8848/nacos  (nacos/nacos)
# Keycloak → http://localhost:7080        (admin/admin)
# Kafka UI → http://localhost:8082
```

## Build

```bash
# Validate all modules (no compilation, fast)
./mvnw validate

# Compile common + identity-service
./mvnw -pl common,identity-service compile

# Build all modules (skip tests for speed)
./mvnw package -DskipTests

# Build a specific service
./mvnw -pl billing-service package
```

## Run

```bash
# Gateway (port 8080)
./mvnw -pl gateway spring-boot:run

# Identity Service (port 8081)
./mvnw -pl identity-service spring-boot:run

# Billing Service (port 8083) — requires identity + property up
./mvnw -pl billing-service spring-boot:run
```

## Test

```bash
# Unit tests (H2 in-memory, no infra needed)
./mvnw -pl identity-service test

# Integration tests (requires live Postgres)
./mvnw -pl billing-service -Pintegration test
```

## Architecture

```
Browser / BootUI (Next.js :3000)
        │
        ▼
  API Gateway :8080
  (Keycloak JWT validation → X-Rm-* headers injected)
  (lb:// Nacos service discovery)
        │
  ┌─────┴──────────────────────────────────────────────┐
  │                                                     │
  ▼                                                     ▼
identity-service:8081          property-service:8082
members / auth / RBDC          rooms / utilities / stays
        │                              │
        ▼                              ▼
billing-service:8083           ops-service:8084
leases / invoices / ledger     tickets / inspections
        │
        ▼
notification-service:8087      report-service:8088
Telegram / email               M26 read-only reports

                  Kafka (rm.*.events topics)
                  ◄──────── all services ─────────►
```

## Key Conventions

- **All money**: integer minor units (paise/satang/cents) — no floats ever
- **Ledger**: append-only, Σdebits = Σcredits enforced by `LedgerBalanceIT`
- **Schema ownership**: Prisma owns all migrations, Flyway is disabled in every service
- **Table quoting**: `globally_quoted_identifiers: true` in every JPA config (Prisma PascalCase tables)
- **Auth (migration period)**: `SessionAuthFilter` accepts both `rm_session` cookie AND `X-Rm-*` gateway headers
- **Outbox**: `domain_events.publishedAt NULL` → `OutboxRelay` polls + publishes to Kafka
