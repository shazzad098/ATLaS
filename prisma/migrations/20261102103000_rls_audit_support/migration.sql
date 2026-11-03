-- Tenant visibility for operational records that were previously only guarded
-- by application filters: the audit trail and support tickets.
--
-- Authentication tables (User, Session, OTP, Membership) stay outside RLS
-- because they must be read before a tenant context exists.

ALTER TABLE "AuditLog" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "AuditLog" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "AuditLog" FOR ALL
  USING (app_bypass() OR "tenantId" IN (SELECT app_user_tenants()))
  WITH CHECK (app_bypass() OR "tenantId" IN (SELECT app_user_tenants()));

ALTER TABLE "SupportTicket" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "SupportTicket" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "SupportTicket" FOR ALL
  USING (app_bypass() OR "tenantId" IN (SELECT app_user_tenants()))
  WITH CHECK (app_bypass() OR "tenantId" IN (SELECT app_user_tenants()));
