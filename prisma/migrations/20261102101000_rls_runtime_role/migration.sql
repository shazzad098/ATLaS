-- Runtime role for RLS-enforced requests.
--
-- The application connects with the database owner (dev: `postgres`) which is a
-- superuser and therefore bypasses RLS even with FORCE ROW LEVEL SECURITY.
-- Restricted request pools run `SET ROLE atlas_app` before serving a query, so
-- merchant/buyer requests are evaluated as a non-owner, non-superuser role.
--
-- Platform and public (unauthenticated) pools intentionally stay on the owner
-- role: they are the documented bypass contexts.
--
-- Requires CREATEROLE (or superuser) when the migration runs.

DO $do$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'atlas_app') THEN
    EXECUTE 'CREATE ROLE atlas_app NOLOGIN';
  END IF;
END
$do$;

-- Let the migration/owner switch into the role. Creator gets admin option on
-- PostgreSQL 16+, and superusers can SET ROLE unconditionally.
DO $do$
BEGIN
  EXECUTE format('GRANT atlas_app TO %I', current_user);
END
$do$;

GRANT USAGE ON SCHEMA public TO atlas_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO atlas_app;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO atlas_app;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO atlas_app;

ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO atlas_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT USAGE, SELECT ON SEQUENCES TO atlas_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT EXECUTE ON FUNCTIONS TO atlas_app;
