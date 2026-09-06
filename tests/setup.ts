/// Vitest setup — runs before any test module is imported.
///
/// Pins DATABASE_URL to the disposable Postgres test database
/// (rentmanager_test, created on first `docker compose up postgres` via
/// deploy/postgres-init). `npm test` resets it via `test:pg:reset`
/// (prisma migrate reset → baseline + triggers → seed) before the run.
/// Pure/unit tests never touch the DB either way.
process.env.DATABASE_URL ??= "postgresql://rentmanager:rentmanager@localhost:5432/rentmanager_test";
