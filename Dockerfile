# ATLaS web app (Next.js + Prisma 7).
#
# Build-time secrets are deliberately dummy values: `prisma generate` only needs
# a syntactically valid DATABASE_URL, and Next must be able to compile without
# a real database or SMS/payment credential. Production secrets are injected at
# runtime by the platform (see docker-compose.yml / docs/operations.md).

FROM node:22-bookworm-slim AS builder
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .

ENV NEXT_TELEMETRY_DISABLED=1
# These are compile-time placeholders, not secrets and not persisted in the
# runtime stage. Real values are injected by the platform when the container runs.
RUN DATABASE_URL="postgresql://build:build@127.0.0.1:5432/atlas_build" \
    AUTH_SECRET="build-only-auth-secret-at-least-32-characters" \
    OTP_HASH_SECRET="build-only-otp-secret-at-least-32-characters" \
    npm run build

FROM node:22-bookworm-slim AS runner
WORKDIR /app

ENV NODE_ENV=production \
    PORT=3000 \
    NEXT_TELEMETRY_DISABLED=1

COPY --from=builder /app ./

EXPOSE 3000

CMD ["npm", "start"]
