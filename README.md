# ATLaS — SaaS E-commerce Store Builder

ATLaS is a multi-tenant Bangladesh-focused e-commerce SaaS built with Next.js 16, React 19, TypeScript, Prisma 7 and PostgreSQL. It supports merchant storefronts, catalog/inventory, COD and gateway adapters, coupons, orders, subscriptions, platform fees and Super Admin operations.

## Local development

```bash
cp .env.example .env
npm ci
npm run db:generate
npm run db:migrate
npm run db:seed
npm run dev
```

The application is available at `http://localhost:3000`. Keep `.env` private. For local development without live gateway credentials, payment adapters use the sandbox callback flow.

## Verification commands

```bash
npm run typecheck
npm run lint
npm test
npm run build
```

`npm test` runs the checked-in regression suite under `src/**/*.test.ts`. The legacy `client/` and `server/` directories are retained as historical scaffold files and are not part of the current Next.js runtime or lint scope.

## Production deployment

1. Provision PostgreSQL 16+ and set `DATABASE_URL`.
2. Set strong, independently generated `AUTH_SECRET`, `OTP_HASH_SECRET` and `CRON_SECRET` values.
3. Set `NEXT_PUBLIC_APP_URL`, `APP_ROOT_DOMAIN` and storefront domain configuration.
4. Configure the selected SMS/email/payment/courier providers; do not enable a merchant payment method until its credentials are configured.
5. Run `npm ci`, `npm run db:generate`, `npm run db:migrate`, and `npm run build`.
6. Start with `npm run start` behind TLS and a reverse proxy.
7. Configure a scheduler to `POST /api/internal/cron/billing` with `Authorization: Bearer $CRON_SECRET` at least every 15 minutes. This runs billing lifecycle transitions and expires abandoned online checkouts, releasing stock and coupon reservations.

All API responses use a consistent envelope. API routes include `x-request-id`, security headers, idempotency support for checkout, database-backed rate limiting and tenant authorization. Payment webhooks require provider signature verification and are claimed idempotently before applying order side effects.

## Important operational notes

Database migrations are checked in under `prisma/migrations/`; never use `prisma db push` in production. Before enabling real payments, test successful, failed, duplicate, amount-mismatch, timeout and refund callbacks in staging. Configure application logs and an external error/metric sink for production observability.
