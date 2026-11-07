# ATLaS production image (Next.js standalone output).
#
# Build stages:
#   deps    → exact dependencies from the lockfile
#   builder → `prisma generate` + `next build` with build-only placeholder
#             secrets (the real values are injected at runtime)
#   runner  → only the traced server bundle, static assets and public files,
#             running as an unprivileged user
#
# Migrations are a release step, not a container start step:
#   npx prisma migrate deploy   (see docs/operations.md)

FROM node:25-bookworm-slim AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

FROM node:25-bookworm-slim AS builder
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Compile-time placeholders, not secrets: `next build` must run without a live
# database or provider credentials. Nothing here survives into the runtime stage.
RUN DATABASE_URL="postgresql://build:build@127.0.0.1:5432/atlas_build" \
    AUTH_SECRET="build-only-auth-secret-at-least-32-characters" \
    OTP_HASH_SECRET="build-only-otp-secret-at-least-32-characters" \
    npx prisma generate \
 && npm run build

FROM node:25-bookworm-slim AS runner
WORKDIR /app
ENV NODE_ENV=production \
    PORT=3000 \
    HOSTNAME=0.0.0.0 \
    NEXT_TELEMETRY_DISABLED=1

RUN groupadd --system --gid 1001 nodejs \
 && useradd --system --uid 1001 --gid nodejs --create-home nextjs

COPY --from=builder --chown=nextjs:nodejs /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs
EXPOSE 3000

# Readiness probe: the platform health endpoint checks the database too.
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3000/api/v1/health').then(r => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"

CMD ["node", "server.js"]
