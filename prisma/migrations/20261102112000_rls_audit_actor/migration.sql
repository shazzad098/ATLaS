-- Allow an authenticated user to write/read their own account-level audit
-- events (login, logout, 2FA) which are not attached to a tenant.

DROP POLICY IF EXISTS tenant_isolation ON "AuditLog";
CREATE POLICY tenant_isolation ON "AuditLog" FOR ALL
  USING (
    app_bypass()
    OR "tenantId" IN (SELECT app_user_tenants())
    OR ("tenantId" IS NULL AND "actorId" = app_user_id())
  )
  WITH CHECK (
    app_bypass()
    OR "tenantId" IN (SELECT app_user_tenants())
    OR ("tenantId" IS NULL AND "actorId" = app_user_id())
  );
