# JPA ↔ Prisma column mapping

The Spring Boot backend binds JPA entities to the **exact tables and columns**
Prisma already created (see `prisma/migrations/20260906000000_init_postgres`),
so both stacks read/write the same rows during the migration.

## Naming rules Prisma used (no `@@map` anywhere)
- **Table names** = the Prisma model name, PascalCase, quoted: `"User"`, `"MemberProfile"`.
- **Column names** = the Prisma field name, camelCase, quoted: `"passwordHash"`, `"homePropertyId"`, `"createdAt"`.
- **Primary keys** = `String` cuid values (`@default(cuid())`), generated app-side.
- **Timestamps** = `TIMESTAMP(3)`; mapped to `java.time.Instant`.
- **Money** = integer minor units (`Int`); mapped to `int`/`Integer`. Never `float`.

Therefore every JPA entity uses:
```java
@Entity @Table(name = "User")            // exact table
class User {
  @Id @Column(name = "id") String id;    // cuid
  @Column(name = "passwordHash") ...      // exact camelCase column
}
```

## New, backend-owned columns (Flyway, additive)
- `Tenant` table (SaaS tenant registry) — `V2__add_tenant.sql`.
- `tenantId TEXT NOT NULL DEFAULT 'DEFAULT'` on tenant-scoped tables, backfilled
  to the `DEFAULT` tenant so existing single-tenant data is untouched. `V2`
  covers the Phase 1–3 tables; `V3__billing_tenant.sql` extends the same pattern
  to `Invoice`/`InvoiceItem`/`CreditNote` (+ a `(tenantId,memberProfileId,status)`
  index powering the leasing open-dues gate). `V4__payments_tenant.sql` extends
  it to `Payment`/`PaymentAllocation`. `V5__deposits_tenant.sql` covers
  `Deposit`/`DepositTransaction`. `V6__ledger.sql` tenant-scopes
  `LedgerTransaction`/`LedgerEntry` (but **not** `LedgerAccount` — it is shared
  reference data) and idempotently seeds the 14 system accounts.

## Auth compatibility (must match byte-for-byte)
| Concern | Next (TS) | Backend (Java) |
|---|---|---|
| Session cookie | `rm_session`, httpOnly, SameSite=Lax | same (`AuthController`) |
| Session lookup | `Session.tokenHash = sha256(hex cookie token)` | `Tokens.sha256Hex` |
| Password | `scrypt:salt:hash`, N=16384,r=8,p=1,keyLen=64; salt = hex string bytes | `PasswordHasher` (RFC 7914 scrypt) |
| TOTP step | password step → `{ totpRequired, challenge }` (5-min HMAC) | `LoginChallenge` |
| Effective perms | union of role permissions | `PermissionResolver` |
| `can()` | `src/lib/rbac/can.ts` | `Rbdc.can()` |

## Entities mapped in Phase 1
`Party, User, Session, Role, Permission, RolePermission, UserRole,
UserPropertyAssignment, MemberProfile, EmergencyContact, Property, Building,
Floor, Room, Bed, AuditLog, Tenant`.

## Entities mapped in Phases 2–4
- Phase 2 (owners M03): `OwnerProfile, OwnerPayoutMethod`.
- Phase 3 (leasing M05): `Lease, LeaseService`, `NumberSequence` (kernel).
- Phase 4 (billing M07): `Invoice, InvoiceItem, CreditNote`. Money kept in
  integer minor units; `amountDueMinor` maintained as `total − paid − credited`
  (≥0) exactly as `recomputeAmountsTx` (now `Invoice.recompute()`). `CreditNote`
  is append-only; issued invoices stay immutable (credits adjust
  `amountCreditedMinor`, never items).
- Phase 5 (billing M09): `Payment, PaymentAllocation`. `remainingMinor` is the
  unallocated member credit; `receiptCode`/`gatewayRef`/`idempotencyKey` are
  unique. Confirmation increments each allocated invoice's `amountPaidMinor` and
  re-derives status via `Invoice.recompute()`. Year-scoped codes `PMT-YYYY-####`
  / `RCP-YYYY-####` use per-year `NumberSequence` keys (`PMT:YYYY`, `RCP:YYYY`).
- Phase 6 (finance M10): `Deposit, DepositTransaction` (`V5__deposits_tenant.sql`).
  A deposit is billed as an `isDeposit=true` invoice (period sentinel
  `2000-01-01`, due at move-in) via `BillingQueryApi.billDepositInvoice`;
  `held`/`settled` are derived from the invoice's `amountPaidMinor` and the
  movements' released total. Cross-module cycles are inverted via named-interface
  SPIs (`leasing::spi`, `billing::spi`) that finance implements.
- Phase 8 (M06 rent engine): `TaxRule, LateFeeRule` (billing) + `Setting`
  (kernel), all bound to their Prisma tables. `V7__rent_engine_tenant.sql`
  tenant-scopes the pricing catalog (TaxRule/LateFeeRule/RentPlan/DiscountRule).
  `Setting` stays global (JSON blob per `m28.*` group key), read by
  `kernel.settings.SettingsService`. The engine itself (`billing.engine`) is pure
  and holds no state.
- Phase 7 (finance M08 ledger): `LedgerAccount, LedgerTransaction, LedgerEntry`
  (`V6__ledger.sql`). `LedgerAccount` is shared reference data (no `tenantId`);
  the books (`LedgerTransaction`/`LedgerEntry`) carry `tenantId`. Entries map via
  `@OneToMany @JoinColumn(transactionId)` (the entity's own `transactionId`
  column is read-only to avoid a double mapping). The ledger is append-only —
  corrections are reversals with a `reversalOf` back-link. Finance's
  `LedgerPostingAdapter` implements `billing.spi.LedgerPostingPort` (`@Primary`,
  replacing the no-op) so invoice/payment/deposit events post balanced entries.
- Phase 8 (utilities M11): `Meter, MeterReading, Tariff, UtilityCharge`
  (`V8__utilities_tenant.sql`). Readings store integer **milli-units**
  (`value × 1000`); `Tariff.tiers` is the first `jsonb` column mapped — a Jackson
  `JsonNode` field with `@JdbcTypeCode(SqlTypes.JSON)` (mapping a `String` would
  double-encode). `UtilityCharge.readingId` is unique (one charge per reading);
  charges are `pending` until billed. Utilities implements the billing-owned
  `billing.spi.UtilityBillingPort` via `UtilityBillingAdapter` (`@Primary`,
  replacing `NoopUtilityBilling`), so generation folds pending charges into the
  next invoice as `utility` lines and void reverts them — no billing→utilities
  dependency.

Remaining models follow the same recipe as their modules are ported.
