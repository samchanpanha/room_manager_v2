#!/bin/sh
set -e

echo "╔══════════════════════════════════════════════════════╗"
echo "║          RentManager — Docker Entry Point            ║"
echo "╚══════════════════════════════════════════════════════╝"

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