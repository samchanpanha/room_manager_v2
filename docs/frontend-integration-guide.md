# Frontend → Backend integration (step by step)

How the Next.js UI is decoupled from Prisma and re-pointed at the Spring Boot
backend, one module at a time (strangler-fig). Nothing breaks while
`BACKEND_ORIGIN` is unset — the rewrites are inert and the legacy handlers serve
everything.

## The two seams

1. **Proxy (browser + client components).** `next.config.ts` rewrites the
   `MIGRATED_PREFIXES` from `src/lib/backend/config.ts` to `BACKEND_ORIGIN`.
   Client components keep calling relative `/api/*` — no code change — and the
   request is transparently proxied. Same origin ⇒ the `rm_session` cookie flows,
   no CORS.

2. **Typed client (server components / server actions).** RSC pages that used to
   query Prisma call `src/lib/backend/client.ts` instead, which forwards the
   session cookie so the backend's RBDC sees the same user.

## Enabling the backend

```bash
# backend running on :8080 (see backend/README.md)
export BACKEND_ORIGIN=http://localhost:8080
npm run dev
```

## Migrate a module — the recipe

For each module: confirm the backend endpoint exists → add its prefix to
`MIGRATED_PREFIXES` → replace RSC Prisma reads with the typed client → delete the
old `route.ts` + `src/lib/<module>` server code → contract-test + smoke.

### Example: the Members list page

**Before** — `src/app/(admin)/members/page.tsx` reads Prisma directly:

```tsx
import { prisma } from "@/lib/db";
import { getAuthUser } from "@/lib/auth/session";

export default async function MembersPage({ searchParams }) {
  const user = await getAuthUser();
  const sp = await searchParams;
  const where = { /* hand-rolled RBDC scope + filters */ };
  const members = await prisma.memberProfile.findMany({ where, include: { party: true } });
  return <MembersTable rows={members} />;
}
```

**After** — the page fetches from the backend; RBDC scoping now lives server-side
in `MemberService`:

```tsx
import { api, BackendError } from "@/lib/backend/client";

export default async function MembersPage({ searchParams }) {
  const sp = await searchParams;
  let rows;
  try {
    rows = await api.members.list({ status: sp.status, propertyId: sp.propertyId });
  } catch (e) {
    if (e instanceof BackendError && e.status === 403) {
      return <EmptyState title="No access" hint="Your roles do not include read on Members (M02)." />;
    }
    throw e;
  }
  return <MembersTable rows={rows} />;
}
```

Then:
- add nothing (`/api/members` is already in `MIGRATED_PREFIXES`),
- once every members page/route is ported, delete
  `src/app/api/members/**/route.ts`, and
- remove now-dead `src/lib` server helpers for members.

### Client component example (no change needed)

```tsx
// A client component POSTing to create a member — unchanged.
await fetch("/api/members", {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify(payload)
});
// Proxied to the Spring backend because "/api/members" is a migrated prefix.
```

## Rollback

Remove the prefix from `MIGRATED_PREFIXES` (or unset `BACKEND_ORIGIN`) and the
request falls straight back to the in-app handler. Because the backend writes to
the same database with compatible IDs and auth, no data migration is involved in
a flip or a rollback.

## Cross-origin deployment (optional)

If FE and BE are deployed on different origins instead of proxied:
- client calls: add `credentials: "include"`;
- backend: enable CORS with credentials + allowed origin (stub in
  `platform/security/SecurityConfig` `cors(...)`);
- cookie: set `SameSite=None; Secure`.
