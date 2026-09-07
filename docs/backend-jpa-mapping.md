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

## New, backend-owned columns (Flyway `V2__add_tenant.sql`, additive)
- `Tenant` table (SaaS tenant registry).
- `tenantId TEXT NOT NULL DEFAULT 'DEFAULT'` on tenant-scoped tables, backfilled
  to the `DEFAULT` tenant so existing single-tenant data is untouched.

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

Remaining 69 models follow the same recipe as their modules are ported (Phases 2–6).
