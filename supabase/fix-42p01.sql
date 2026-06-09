-- Supabase 42P01 / PGRST205 recovery script.
--
-- Run this in the Supabase SQL Editor when the app can read tables but cannot
-- write data, or when PostgREST reports that a public table is missing from the
-- schema cache. This script is safe to rerun.

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
    CHECK (status IN ('draft', 'collecting', 'submitted', 'reviewed', 'closed')),
  created_by TEXT REFERENCES public.users(id),
  closed_by TEXT REFERENCES public.users(id),
  closed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.production_entries (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  report_id TEXT NOT NULL REFERENCES public.production_reports(id) ON DELETE CASCADE,
  user_id TEXT REFERENCES public.users(id),
  user_name TEXT,
  equipment TEXT NOT NULL CHECK (equipment IN ('P15', 'P5', 'R/M')),
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
    '소재 문제', '공정 문제', '열관리 문제', '설비 문제',
    '인원/조직 문제', '품질 문제', '계획 변경', '기타'
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

CREATE TABLE IF NOT EXISTS public.report_status_logs (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  report_id TEXT NOT NULL REFERENCES public.production_reports(id) ON DELETE CASCADE,
  user_id TEXT REFERENCES public.users(id),
  status TEXT NOT NULL,
  memo TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO public.users (id, name, email, employee_no, role, assigned_equipment, assigned_shift, can_write, can_edit, can_delete)
VALUES
  ('11111111-1111-1111-1111-111111111111', '관리자', 'admin@forging.com', '10001', 'admin', ARRAY['P15', 'P5', 'R/M'], NULL, TRUE, TRUE, TRUE),
  ('22222222-2222-2222-2222-222222222222', '김회근 부장', 'hoegeun.kim@forging.com', '10002', 'manager', ARRAY['P15', 'P5', 'R/M'], NULL, TRUE, TRUE, FALSE),
  ('33333333-3333-3333-3333-333333333333', '김현 차장', 'hyun.kim@forging.com', '10003', 'user', ARRAY['P15'], NULL, TRUE, FALSE, FALSE),
  ('44444444-4444-4444-4444-444444444444', '구병준 차장', 'byeongjun.koo@forging.com', '10004', 'user', ARRAY['P5'], NULL, TRUE, FALSE, FALSE),
  ('55555555-5555-5555-5555-555555555555', '우재한 과장', 'jaehan.woo@forging.com', '10005', 'user', ARRAY['R/M'], NULL, TRUE, FALSE, FALSE),
  ('66666666-6666-6666-6666-666666666666', '이은서 대리', 'eunseo.lee@forging.com', '10006', 'manager', ARRAY['P15', 'P5', 'R/M'], NULL, TRUE, TRUE, FALSE)
ON CONFLICT (email) DO UPDATE SET
  name = EXCLUDED.name,
  employee_no = EXCLUDED.employee_no,
  role = EXCLUDED.role,
  assigned_equipment = EXCLUDED.assigned_equipment,
  assigned_shift = EXCLUDED.assigned_shift,
  can_write = EXCLUDED.can_write,
  can_edit = EXCLUDED.can_edit,
  can_delete = EXCLUDED.can_delete;

INSERT INTO public.equipment_targets (equipment, shift, product_target, billet_target, effective_date)
VALUES
  ('P15', '주간', 72500, 75000, '2026-01-01'),
  ('P15', '야간', 72500, 75000, '2026-01-01'),
  ('P5', '주간', 35000, 25000, '2026-01-01'),
  ('P5', '야간', 35000, 25000, '2026-01-01'),
  ('R/M', '주간', 100000, 0, '2026-01-01'),
  ('R/M', '야간', 100000, 0, '2026-01-01')
ON CONFLICT DO NOTHING;

INSERT INTO public.production_period_targets (period, product_target, billet_target, effective_date)
VALUES
  ('weekly', 0, 0, '2026-01-01'),
  ('monthly', 0, 0, '2026-01-01'),
  ('yearly', 0, 0, '2026-01-01')
ON CONFLICT DO NOTHING;

CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_production_reports_updated_at ON public.production_reports;
CREATE TRIGGER trigger_production_reports_updated_at
  BEFORE UPDATE ON public.production_reports
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

DROP TRIGGER IF EXISTS trigger_production_entries_updated_at ON public.production_entries;
CREATE TRIGGER trigger_production_entries_updated_at
  BEFORE UPDATE ON public.production_entries
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

DROP TRIGGER IF EXISTS trigger_report_comments_updated_at ON public.report_comments;
CREATE TRIGGER trigger_report_comments_updated_at
  BEFORE UPDATE ON public.report_comments
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

GRANT USAGE ON SCHEMA public TO anon, authenticated;

DO $$
DECLARE
  table_name TEXT;
BEGIN
  FOREACH table_name IN ARRAY ARRAY[
    'users',
    'production_reports',
    'production_entries',
    'equipment_targets',
    'production_period_targets',
    'report_comments',
    'report_status_logs'
  ]
  LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', table_name);
    EXECUTE format('GRANT SELECT ON public.%I TO anon, authenticated', table_name);
    EXECUTE format('GRANT INSERT, UPDATE, DELETE ON public.%I TO authenticated', table_name);
  END LOOP;
END $$;

DO $$
DECLARE
  policy_record RECORD;
BEGIN
  FOR policy_record IN
    SELECT *
    FROM (VALUES
      ('users', 'Authenticated users can manage users'),
      ('production_reports', 'Authenticated users can manage reports'),
      ('production_entries', 'Authenticated users can manage entries'),
      ('equipment_targets', 'Authenticated users can manage targets'),
      ('production_period_targets', 'Authenticated users can manage period targets'),
      ('report_comments', 'Authenticated users can manage comments'),
      ('report_status_logs', 'Authenticated users can manage status logs')
    ) AS policies(table_name, policy_name)
  LOOP
    EXECUTE format(
      'DROP POLICY IF EXISTS %I ON public.%I',
      policy_record.policy_name,
      policy_record.table_name
    );
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR ALL USING (auth.role() = ''authenticated'') WITH CHECK (auth.role() = ''authenticated'')',
      policy_record.policy_name,
      policy_record.table_name
    );
  END LOOP;
END $$;

NOTIFY pgrst, 'reload schema';
