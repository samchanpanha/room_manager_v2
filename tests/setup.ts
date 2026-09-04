/// Vitest setup — runs before any test module is imported.
///
/// Guards the demo database: without an explicit DATABASE_URL the Prisma
/// client falls back to .env (dev.db). Tests must never mutate dev.db, so we
/// pin the URL to the disposable copy (prisma/test-billing.db, refreshed by
/// `npm run test:billing`). Pure/unit tests never touch the DB either way.
process.env.DATABASE_URL ??= "file:./test-billing.db";
