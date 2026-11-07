# Contributing

## Before you open a PR

Run the same gates CI runs. They are ordered cheapest-first:

```bash
npm run typecheck
npm run lint
npm test            # unit suite, no database
npm run test:db     # service + RLS integration suite (needs a migrated database)
npm run build
```

`npm run test:db` creates and removes its own tenants; point `DATABASE_URL` at a
disposable database and apply migrations first (`npm run db:migrate`).

## Rules that have already caused bugs here

These are not style preferences — each one maps to an incident or an audit
finding in `docs/audits/`:

1. **Never trust a `tenantId` or `storeId` from a payload.** Derive tenancy from
   the membership (`src/lib/tenant.ts`) and check store ownership with
   `assertStoreAccess`.
2. **Every mutation re-checks the entitlement state.** Call
   `requireWritableTenant()` before writing; a read-only workspace must not gain
   rows.
3. **Money never touches floating point.** Use `src/lib/money.ts` (integer
   paisa); DB columns are `Decimal(14,2)`. A decimal *string* is assignable to a
   Prisma `Decimal` field, so never write `as never` there — a cast would also
   silence a genuine unit error.
4. **A gateway callback is a claim, not a fact.** Verify server-to-server before
   crediting an order, and deduplicate on `(provider, eventKey)`.
5. **Check-then-write is a race.** Use a conditional `UPDATE`/unique index (see
   `reserveStock` and the checkout idempotency key) instead of reading first.
6. **Anything after a commit is best-effort.** Notifications, webhooks and
   analytics must not be able to fail a request whose data is already durable.
7. **A new table needs an RLS policy** in the same migration, and a line in
   `src/lib/rls.test.ts` proving it isolates.

## Migrations

- Forward-only. `prisma migrate deploy` runs in CI before the tests, so a
  migration that does not reproduce the schema fails the build.
- Add the RLS policy (and the `atlas_app` grant) in the same migration as the
  table.
- Never edit a migration that has shipped.

## Commits

Conventional commits, one concern per commit:

```
feat(storefront): add per-store sitemap
fix(billing): never suspend a Free subscription
test(checkout): cover concurrent idempotency keys
docs(ops): document the rate-limit driver
```

## Code layout

| Path | Owns |
| --- | --- |
| `src/lib/services` | business rules shared by pages, server actions and the API |
| `src/lib` | cross-cutting domain helpers (money, plans, entitlements, rbac, tenant) |
| `src/app` | routes only — thin, delegating to services |
| `prisma` | schema, migrations, seed |
| `src/lib/testing` | fixtures for the integration suite |
