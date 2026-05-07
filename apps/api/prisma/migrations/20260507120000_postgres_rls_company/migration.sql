-- Defensa en profundidad: Row-Level Security por companyId
-- Variables esperadas por conexión/statement:
-- - app.company_id (text)
-- - app.is_admin (text: 'true'/'false')

-- Helpers: usar current_setting(..., true) para no fallar si no existe
-- (si es null, la policy deniega).

-- CLIENT
ALTER TABLE "Client" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Client" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "client_company_isolation" ON "Client";
CREATE POLICY "client_company_isolation" ON "Client"
  USING (
    current_setting('app.is_admin', true) = 'true'
    OR "companyId" = current_setting('app.company_id', true)
  )
  WITH CHECK (
    current_setting('app.is_admin', true) = 'true'
    OR "companyId" = current_setting('app.company_id', true)
  );

-- FV STUDY
ALTER TABLE "FvStudy" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "FvStudy" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "fvstudy_company_isolation" ON "FvStudy";
CREATE POLICY "fvstudy_company_isolation" ON "FvStudy"
  USING (
    current_setting('app.is_admin', true) = 'true'
    OR "companyId" = current_setting('app.company_id', true)
  )
  WITH CHECK (
    current_setting('app.is_admin', true) = 'true'
    OR "companyId" = current_setting('app.company_id', true)
  );

-- QUOTE
ALTER TABLE "Quote" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Quote" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "quote_company_isolation" ON "Quote";
CREATE POLICY "quote_company_isolation" ON "Quote"
  USING (
    current_setting('app.is_admin', true) = 'true'
    OR "companyId" = current_setting('app.company_id', true)
  )
  WITH CHECK (
    current_setting('app.is_admin', true) = 'true'
    OR "companyId" = current_setting('app.company_id', true)
  );

-- COMPANY PROFILE (branding)
ALTER TABLE "CompanyProfile" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "CompanyProfile" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "companyprofile_company_isolation" ON "CompanyProfile";
CREATE POLICY "companyprofile_company_isolation" ON "CompanyProfile"
  USING (
    current_setting('app.is_admin', true) = 'true'
    OR "companyId" = current_setting('app.company_id', true)
  )
  WITH CHECK (
    current_setting('app.is_admin', true) = 'true'
    OR "companyId" = current_setting('app.company_id', true)
  );

