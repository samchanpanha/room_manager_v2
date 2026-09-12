# Reality-Check: "Split RentManager → Spring Boot Microservices" Plan vs. This Codebase

> Status: draft — written 2026-09-12 against the monolith in `rentmanager/`.
> Companion to the pasted plan ("Split RentManager → Spring Boot Microservices", v1.0).
> Follow-up decisions the plan never states are listed at the bottom and are still open.

## 1. Verdict (headline)

The plan is well-written, production-aware, and internally coherent — but as a description of
*this* project it has the premise inverted in a way that invalidates a large fraction of its work
items; it silently ignores that this exact work was already attempted and deleted; and it
under-weights the single hardest problem (money integrity under distributed transactions) while
deploying an operations footprint the project cannot sustain. The broadly right ideas survive, but
the build-out as written would burn weeks on dead ends.

## 2. What this repo actually is (evidence snapshot, 2026-09-12)

- **A complete Next.js + Prisma + PostgreSQL property-management monolith** that *is itself* the
  RentManager replacement (members/tenants, leases, rent engine, invoices, ledger, payments/QR Pay,
  deposits, utilities, services, POS & stock, operations, reports, Telegram, RBDC).
- Scale: **188** API route handlers under `src/app/api`, **87** Prisma models in one schema
  (`prisma/schema.prisma`, ~1,900 LOC), **43** domain files reference `prisma.*` directly,
  **~19.8k LOC** across `src/lib/*`, **56** Vitest test files pinning money math and workflows.
- **Deployment footprint is a single box**: `docker-compose.yml` = `postgres` + `rentmanager`
  (Next app) + `rentmanager-storage` + `rentmanager-backups`.
- **A Spring Modulith predecessor already existed and was deleted.** `docs/backend-split-plan.md`
  (43 KB) documents a full Spring Boot port planned and marked **DONE through module M15 (POS)**,
  using a strangler-fig proxy flip. Commit `f215a50` ("remove backend, because it is wrong code")
  deleted the entire `backend/` tree. **No post-mortem exists** — `docs/BUILD_LOG.md` stops before
  the removal.
- **Strangler-fig machinery is still in the repo, dormant**: `src/lib/backend/config.ts`
  (`MIGRATED_PREFIXES`, 25 prefixes), typed `backendFetch` client, `next.config.ts` rewrites.
  `BACKEND_ORIGIN` defaults to `""`, so it is off.

## 3. Three reframings the plan does not make

### 3.1 "Split RentManager" is a migration source, not an integration target

The plan spends substantial scope on living with a third-party system of record:
`rentmanager-adapter-service` (Sprint B), polling schedulers, webhook analysis, rate-limit-aware
adapter, contract-drift monitoring, API-cost modeling — plan §0.2, §0.6, §1.7, Sprint B, and
recommendations #1, #2, #3, #12.

But this app already **replaces** Split RentManager. At most, RentManager is a one-time backfill
source for historical data (see plan §5.4). An adapter that polls a system being retired, in
perpetuity, is ~5–6 weeks of work aimed at a target being deleted.

**Action:** re-scope all RentManager work to *backfill + reconciliation*, not integration.

### 3.2 This was already built once and deleted — and there is no debrief

`docs/backend-split-plan.md` documents the prior attempt: auth-compatibility contract, Flyway
additive migrations, Hibernate `tenant_id` multi-tenancy, and phases 2–12 **all marked DONE**
through M15. Then it was torn out wholesale as "wrong code." The pasted plan is the same operation
at ~10× scope (true microservices + Nacos + Kafka + Keycloak + K8s) with **no task for
understanding why the first attempt failed**. That is the highest-probability failure mode in the
document.

**Action:** the plan needs a concrete Phase 0 item: "Debrief the removed Spring backend and record
root cause." Nothing else can de-risk the repeat.

### 3.3 The migration machinery this plan would build already exists

The strangler seams the plan proposes to build in Sprint F are already in the repo:
`MIGRATED_PREFIXES`, `backendFetch`, and `next.config.ts` rewrites, all wired but dormant. The plan
silently abandons them for a fresh service-per-domain decomposition.

**Action:** decide explicitly: continue the existing strangler, or replace it. Do not silently do
either.

## 4. Assumption-by-assumption scorecard

| Plan assumption | Reality in this repo | Verdict |
|---|---|---|
| Integrate with Split RentManager (SYNC/PROXY/facade) | We *replace* it; only backfill applies | **Wrong premise** |
| Port domain logic to services; re-derive behavior | 87 models, 43 `prisma.*`-coupled files, ~20k LOC of tested TS with exact money math | **Reuse is highest value, not re-derivation** |
| db-per-service + Saga for cross-service money writes | Money integrity today = same-DB transactions + FK constraints across Invoice → Payment → Allocation → LedgerEntry → Deposit; INTENT.md §2 *mandates* ACID ("no deletions of posted records, idempotent") | **Single biggest risk, under-weighted** |
| "Map roles to Keycloak realm roles; enforce via JWT claims" | RBDC is *dynamic* — runtime-created roles, `module × action × scope`, including PROPERTY-scoped and record-level OWN, with a snapshot-tested permission matrix | **Functional regression unless Keycloak stays authentication-only** |
| BootUI consumes services via Gateway (Sprint F) | Next.js app is already the frontend; proxying already wired | Mostly existing |
| Nacos cluster + Kafka + Schema Registry + Keycloak + K8s/HPA | Single-box docker-compose today | One-order ops jump; plan never justifies *why* |

## 5. The money-integrity risk (emphasis)

Plan §3.2 recommends choreography for short flows and orchestration for longer ones. But nearly
every money flow here is long, and today it is **atomic**: *lease → schedule → invoice → payment
allocation → ledger entry → deposit* — one transaction, one database.

Moving that to outbox + Saga + idempotent consumers converts the core of the product from ACID to
eventually-consistent. The compensation logic ("void invoice", "refund payment", "reverse ledger
entry") becomes the hardest, most security-sensitive code in the system. This trade is legitimate
only if there is a concrete reason (team scale, PCI scope isolation, independent scaling). The plan
never states one.

## 6. What survives (keep from the plan)

- **Phase 0 discipline** — ADR-driven, NFRs, risk register — scoped to *replacement* (backfill, not
  adapter).
- **Data migration with checksum reconciliation** (plan §5.4, rec #3) — this *is* the RentManager
  work in a replace scenario.
- **Behavioral parity testing** — the prior `backend-split-plan.md` described "replay identical
  requests old vs new, golden-value money tests." Correct medicine; promote it to the top.
- **Contract-first OpenAPI, Testcontainers, outbox + idempotency, feature flags, observability** —
  language-agnostic good practice.
- **The existing strangler seams** — the highest-leverage asset for any incremental split.

## 7. Honest alternative sequencing

If a Java backend is genuinely wanted:

1. **Write the post-mortem first.** Root-cause why the M02–M15 Spring Modulith port was "wrong
   code."
2. **Reuse the TS behavior as the spec.** Do not re-derive money math in Java. Encode the existing
   `src/lib/billing`, `src/lib/ledger`, `src/lib/deposits` tests as the behavioral contract.
3. **Flip one module at a time through the existing seams** (`MIGRATED_PREFIXES`), each flip
   independently revertible, with parity tests before flip.

True per-domain microservices + Kafka + Nacos only earn their keep with a written reason. Nothing in
the repo or the plan names one today.

## 8. Open decisions (the plan never states them)

1. **Why microservices?** — scale, team size, compliance isolation, or platform convention. This is
   the pivotal NFR and it is absent.
2. **What was the last port's "wrong code"?** — behavior drift? auth incompatibility? maintenance
   weight? AI-generated junk? The answer determines whether any Spring rewrite is sound or a repeat.
3. **Continue the strangler, or replace it?** — the repo already has forward-migration machinery;
   the plan ignores it.

---

*Draft of 2026-09-12. Update §7/§8 as decisions land; this doc is orthogonal to (not derived from) the pasted plan.*