# ──────────────────────────────────────────────────────────────────────────────
# RentManager — Multi-stage Dockerfile (Next.js 15 + Prisma + SQLite)
# ──────────────────────────────────────────────────────────────────────────────

# ── Stage 1: Install dependencies ────────────────────────────────────────────
FROM node:20-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY prisma ./prisma/
RUN npx prisma generate

# ── Stage 2: Build the application ───────────────────────────────────────────
FROM node:20-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npx prisma generate
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

# ── Stage 3: Production runner ────────────────────────────────────────────────
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Copy the FULL node_modules (includes prisma CLI, tsx, esbuild — needed
# at runtime for migrations and seeding)
COPY --from=builder /app/node_modules ./node_modules

# Copy the built app
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/next.config.ts ./next.config.ts
COPY --from=builder /app/tsconfig.json ./tsconfig.json
COPY --from=builder /app/next-env.d.ts ./next-env.d.ts

# Copy prisma schema, migrations, and seed script
COPY --from=builder /app/prisma ./prisma

# Copy the seed script and its runtime source dependencies
COPY --from=builder /app/src ./src
COPY --from=builder /app/package.json ./package.json

# Copy entrypoint
COPY docker-entrypoint.sh /docker-entrypoint.sh
RUN chmod +x /docker-entrypoint.sh

# Storage directory for dev-disk driver
RUN mkdir -p /app/storage/objects && chown -R nextjs:nodejs /app/storage

# Data directory for SQLite database
RUN mkdir -p /app/data && chown -R nextjs:nodejs /app/data

# Backup directory
RUN mkdir -p /app/backups && chown -R nextjs:nodejs /app/backups

USER nextjs

EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

ENTRYPOINT ["/docker-entrypoint.sh"]
CMD ["npm", "run", "start"]