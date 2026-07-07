-- Forging Production App -> Forging Insight migration schema.
--
-- Notes from source grep:
-- - SELECT is used on: users, production_reports, production_entries,
--   equipment_targets, production_period_targets, report_comments.
-- - INSERT/UPDATE are used on: users, production_reports, production_entries,
--   equipment_targets, production_period_targets, report_comments.
-- - DELETE is used on: users, production_reports, production_entries.
-- - report_status_logs exists in the legacy schema, but runtime grep did not
--   find app usage, so it is intentionally omitted here.
-- - Storage usage grep: no supabase.storage / bucket usage found in the app
--   source, so no bucket policies are created in this migration.
--
-- The old schema had production_reports.closed_by / production_reports.closed_at.
-- Those columns are not recreated here; the migration script strips them.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS public.users (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  employee_no TEXT UNIQUE,
  role TEXT NOT NULL CHECK (role IN ('admin', 'manager', 'user', 'viewer')),
  assigned_equipment TEXT[] DEFAULT '{}',
  assigned_shift TEXT CHECK (assigned_shift IN ('주간', '야간')),
  can_write BOOLEAN NOT NULL DEFAULT FALSE,
  can_edit BOOLEAN NOT NULL DEFAULT FALSE,
  can_delete BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.production_reports (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  report_date DATE NOT NULL UNIQUE,
  next_plan_date DATE NOT NULL,
  status TEXT NOT NULL DEFAULT 'collecting'
    CHECK (status IN ('draft', 'collecting', 'submitted', 'reviewed')),
  created_by TEXT REFERENCES public.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.production_entries (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  report_id TEXT NOT NULL REFERENCES public.production_reports(id) ON DELETE CASCADE,
  user_id TEXT REFERENCES public.users(id),
  user_name TEXT,
  equipment TEXT NOT NULL CHECK (equipment IN ('P15', 'P5', 'R/M', 'P8')),
  shift TEXT NOT NULL CHECK (shift IN ('주간', '야간')),
  product_plan INTEGER NOT NULL DEFAULT 0,
  product_actual INTEGER NOT NULL DEFAULT 0,
  billet_plan INTEGER NOT NULL DEFAULT 0,
  billet_actual INTEGER NOT NULL DEFAULT 0,
  next_product_plan INTEGER NOT NULL DEFAULT 0,
  next_billet_plan INTEGER NOT NULL DEFAULT 0,
  product_achievement_rate NUMERIC(5,2),
  billet_achievement_rate NUMERIC(5,2),
  reason_category TEXT CHECK (reason_category IN (
    '설비 문제', '공정 문제', '자재 문제', '품질 문제',
    '인원/조직 문제', '안전 문제', '계획 변경', '기타'
  )),
  reason_detail TEXT,
  action_today TEXT,
  recovery_plan TEXT,
  support_request TEXT,
  submit_status TEXT NOT NULL DEFAULT 'not_started'
    CHECK (submit_status IN ('not_started', 'saved', 'submitted', 'returned', 'approved')),
  submitted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(report_id, equipment, shift)
);

CREATE TABLE IF NOT EXISTS public.equipment_targets (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  equipment TEXT NOT NULL CHECK (equipment IN ('P15', 'P5', 'R/M')),
  shift TEXT NOT NULL CHECK (shift IN ('주간', '야간')),
  product_target INTEGER NOT NULL DEFAULT 0,
  billet_target INTEGER NOT NULL DEFAULT 0,
  effective_date DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(equipment, shift, effective_date)
);

CREATE TABLE IF NOT EXISTS public.production_period_targets (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  period TEXT NOT NULL CHECK (period IN ('weekly', 'monthly', 'yearly')),
  product_target INTEGER NOT NULL DEFAULT 0,
  billet_target INTEGER NOT NULL DEFAULT 0,
  effective_date DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(period, effective_date)
);

CREATE TABLE IF NOT EXISTS public.report_comments (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  report_id TEXT NOT NULL REFERENCES public.production_reports(id) ON DELETE CASCADE,
  summary TEXT,
  manager_comment TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_production_reports_updated_at ON public.production_reports;
CREATE TRIGGER trigger_production_reports_updated_at
  BEFORE UPDATE ON public.production_reports
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trigger_production_entries_updated_at ON public.production_entries;
CREATE TRIGGER trigger_production_entries_updated_at
  BEFORE UPDATE ON public.production_entries
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trigger_report_comments_updated_at ON public.report_comments;
CREATE TRIGGER trigger_report_comments_updated_at
  BEFORE UPDATE ON public.report_comments
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.production_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.production_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.equipment_targets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.production_period_targets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.report_comments ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON SCHEMA public FROM anon;
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon;
GRANT USAGE ON SCHEMA public TO authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.users TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.production_reports TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.production_entries TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.equipment_targets TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.production_period_targets TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.report_comments TO authenticated;

DROP POLICY IF EXISTS "users_select_authenticated" ON public.users;
CREATE POLICY "users_select_authenticated" ON public.users
  FOR SELECT USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "users_insert_authenticated" ON public.users;
CREATE POLICY "users_insert_authenticated" ON public.users
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "users_update_authenticated" ON public.users;
CREATE POLICY "users_update_authenticated" ON public.users
  FOR UPDATE USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "users_delete_authenticated" ON public.users;
CREATE POLICY "users_delete_authenticated" ON public.users
  FOR DELETE USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "production_reports_select_authenticated" ON public.production_reports;
CREATE POLICY "production_reports_select_authenticated" ON public.production_reports
  FOR SELECT USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "production_reports_insert_authenticated" ON public.production_reports;
CREATE POLICY "production_reports_insert_authenticated" ON public.production_reports
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "production_reports_update_authenticated" ON public.production_reports;
CREATE POLICY "production_reports_update_authenticated" ON public.production_reports
  FOR UPDATE USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "production_reports_delete_authenticated" ON public.production_reports;
CREATE POLICY "production_reports_delete_authenticated" ON public.production_reports
  FOR DELETE USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "production_entries_select_authenticated" ON public.production_entries;
CREATE POLICY "production_entries_select_authenticated" ON public.production_entries
  FOR SELECT USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "production_entries_insert_authenticated" ON public.production_entries;
CREATE POLICY "production_entries_insert_authenticated" ON public.production_entries
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "production_entries_update_authenticated" ON public.production_entries;
CREATE POLICY "production_entries_update_authenticated" ON public.production_entries
  FOR UPDATE USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "production_entries_delete_authenticated" ON public.production_entries;
CREATE POLICY "production_entries_delete_authenticated" ON public.production_entries
  FOR DELETE USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "equipment_targets_select_authenticated" ON public.equipment_targets;
CREATE POLICY "equipment_targets_select_authenticated" ON public.equipment_targets
  FOR SELECT USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "equipment_targets_insert_authenticated" ON public.equipment_targets;
CREATE POLICY "equipment_targets_insert_authenticated" ON public.equipment_targets
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "equipment_targets_update_authenticated" ON public.equipment_targets;
CREATE POLICY "equipment_targets_update_authenticated" ON public.equipment_targets
  FOR UPDATE USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "production_period_targets_select_authenticated" ON public.production_period_targets;
CREATE POLICY "production_period_targets_select_authenticated" ON public.production_period_targets
  FOR SELECT USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "production_period_targets_insert_authenticated" ON public.production_period_targets;
CREATE POLICY "production_period_targets_insert_authenticated" ON public.production_period_targets
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "production_period_targets_update_authenticated" ON public.production_period_targets;
CREATE POLICY "production_period_targets_update_authenticated" ON public.production_period_targets
  FOR UPDATE USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "report_comments_select_authenticated" ON public.report_comments;
CREATE POLICY "report_comments_select_authenticated" ON public.report_comments
  FOR SELECT USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "report_comments_insert_authenticated" ON public.report_comments;
CREATE POLICY "report_comments_insert_authenticated" ON public.report_comments
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "report_comments_update_authenticated" ON public.report_comments;
CREATE POLICY "report_comments_update_authenticated" ON public.report_comments
  FOR UPDATE USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');

NOTIFY pgrst, 'reload schema';
