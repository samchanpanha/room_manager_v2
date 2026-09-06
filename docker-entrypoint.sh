#!/bin/sh
set -e

echo "╔══════════════════════════════════════════════════════╗"
echo "║          RentManager — Docker Entry Point            ║"
echo "╚══════════════════════════════════════════════════════╝"

# ── 0. Wait for PostgreSQL readiness ──────────────────────────────────────────
echo ""
echo "▶ Waiting for PostgreSQL to accept connections..."
PG_HOST=$(printf '%s' "$DATABASE_URL" | sed -E 's/^postgres(ql)?:\/\/[^@]*@([^:\/]+)(:[0-9]+)?\/.*/\2/')
PG_PORT=$(printf '%s' "$DATABASE_URL" | sed -E 's/^postgres(ql)?:\/\/[^@]*@[^:\/]*:([0-9]+)\/.*/\2/')
[ "${#PG_HOST}" -gt 64 ] && PG_HOST=postgres
PG_PORT="${PG_PORT:-5432}"
until pg_isready -h "$PG_HOST" -p "$PG_PORT" -U rentmanager -q; do
  echo "  … waiting for database to accept connections"
  sleep 2
done
echo "  ✓ PostgreSQL is up"

# ── 1. Run Prisma migrations ─────────────────────────────────────────────────
echo ""
echo "▶ Running database migrations..."
npx prisma migrate deploy --schema=./prisma/schema.prisma
echo "  ✓ Migrations applied"

# ── 2. Seed sample data (idempotent — safe on restart) ────────────────────────
echo ""
echo "▶ Seeding sample data..."
npx tsx prisma/seed.ts
echo "  ✓ Sample data seeded"

# ── 3. Launch the application ─────────────────────────────────────────────────
echo ""
echo "▶ Starting RentManager on port ${PORT:-3000}..."
echo "  Demo login: root@demo.test / Demo1234!"
echo ""
exec "$@"