-- Row-Level Security for super-admin impersonation sessions.
--
-- Found by `src/lib/rls-coverage.test.ts`: the table carries a `tenantId` but
-- was created before the RLS pass and never joined it, so every merchant row of
-- the audit trail was readable by the runtime role.
--
-- Only the platform (bypass) context or the Super Admin who owns the session
-- may read or write it; a merchant never sees who impersonated them, which is
-- deliberate — the merchant-facing audit trail is `AuditLog`.

ALTER TABLE "ImpersonationSession" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ImpersonationSession" FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "impersonation_session_scope" ON "ImpersonationSession";

CREATE POLICY "impersonation_session_scope" ON "ImpersonationSession"
  FOR ALL
  USING (app_bypass() OR "superAdminId" = app_user_id())
  WITH CHECK (app_bypass() OR "superAdminId" = app_user_id());
