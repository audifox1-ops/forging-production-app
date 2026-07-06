-- ============================================================================
-- migration_to_insight.sql
-- 생산일보 앱을 Forging Insight의 Supabase 프로젝트로 통합하기 위한 스키마.
--
-- 구성: 기존 supabase/schema.sql의 DDL·트리거·RLS(authenticated 전용) 전체
--       + add-p8-equipment.sql의 제약 변경(P8 설비 허용).
-- 제외: 시드 데이터 INSERT (users·목표값) — 실데이터가 구 프로젝트에서
--       scripts/migrate-data.mjs 로 이관되므로, 시드가 먼저 들어가면
--       unique 제약(email, equipment+shift+effective_date)과 충돌할 수 있다.
-- 실행: Forging Insight Supabase의 SQL Editor에서 1회 실행 (재실행 안전).
-- 주의: Forging Insight 기존 16개 테이블과 이름 충돌 없음(검증 완료).
--       Supabase Storage는 이 앱에서 미사용(코드 실측) — 버킷/정책 불필요.
-- ============================================================================

-- ============================================================
-- 단조 생산 일일 보고 시스템 - Supabase 스키마
-- ============================================================

-- 유저 테이블
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

-- 생산 보고서 테이블
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

-- 생산 실적 입력 테이블
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

-- 설비별 목표값 테이블
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

-- 기간별 생산 목표값 테이블
CREATE TABLE IF NOT EXISTS public.production_period_targets (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  period TEXT NOT NULL CHECK (period IN ('weekly', 'monthly', 'yearly')),
  product_target INTEGER NOT NULL DEFAULT 0,
  billet_target INTEGER NOT NULL DEFAULT 0,
  effective_date DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(period, effective_date)
);

-- 보고서 코멘트 테이블
CREATE TABLE IF NOT EXISTS public.report_comments (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  report_id TEXT NOT NULL REFERENCES public.production_reports(id) ON DELETE CASCADE,
  summary TEXT,
  manager_comment TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 보고서 상태 로그 테이블
CREATE TABLE IF NOT EXISTS public.report_status_logs (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  report_id TEXT NOT NULL REFERENCES public.production_reports(id) ON DELETE CASCADE,
  user_id TEXT REFERENCES public.users(id),
  status TEXT NOT NULL,
  memo TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- updated_at 자동 갱신 함수
-- ============================================================
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_production_reports_updated_at ON public.production_reports;
CREATE TRIGGER trigger_production_reports_updated_at
  BEFORE UPDATE ON public.production_reports
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS trigger_production_entries_updated_at ON public.production_entries;
CREATE TRIGGER trigger_production_entries_updated_at
  BEFORE UPDATE ON public.production_entries
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================================
-- Row Level Security (RLS) 설정
-- ============================================================
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.production_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.production_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.equipment_targets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.production_period_targets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.report_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.report_status_logs ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON SCHEMA public FROM anon;
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon;
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO authenticated;

-- 모든 인증된 사용자: 조회 가능
DROP POLICY IF EXISTS "Users can view all data" ON public.production_reports;
CREATE POLICY "Users can view all data" ON public.production_reports
  FOR SELECT USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Users can view entries" ON public.production_entries;
CREATE POLICY "Users can view entries" ON public.production_entries
  FOR SELECT USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Users can view targets" ON public.equipment_targets;
CREATE POLICY "Users can view targets" ON public.equipment_targets
  FOR SELECT USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Users can view period targets" ON public.production_period_targets;
CREATE POLICY "Users can view period targets" ON public.production_period_targets
  FOR SELECT USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Users can view users" ON public.users;
CREATE POLICY "Users can view users" ON public.users
  FOR SELECT USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Authenticated users can manage users" ON public.users;
CREATE POLICY "Authenticated users can manage users" ON public.users
  FOR ALL USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Authenticated users can manage targets" ON public.equipment_targets;
CREATE POLICY "Authenticated users can manage targets" ON public.equipment_targets
  FOR ALL USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Authenticated users can manage period targets" ON public.production_period_targets;
CREATE POLICY "Authenticated users can manage period targets" ON public.production_period_targets
  FOR ALL USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Authenticated users can manage reports" ON public.production_reports;
CREATE POLICY "Authenticated users can manage reports" ON public.production_reports
  FOR ALL USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');

-- 인증된 사용자: 본인 항목 수정 가능 (자세한 권한은 앱 레벨에서 처리)
DROP POLICY IF EXISTS "Authenticated users can insert entries" ON public.production_entries;
CREATE POLICY "Authenticated users can insert entries" ON public.production_entries
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Authenticated users can update entries" ON public.production_entries;
CREATE POLICY "Authenticated users can update entries" ON public.production_entries
  FOR UPDATE USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Authenticated users can delete entries" ON public.production_entries;
CREATE POLICY "Authenticated users can delete entries" ON public.production_entries
  FOR DELETE USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Authenticated users can manage comments" ON public.report_comments;
CREATE POLICY "Authenticated users can manage comments" ON public.report_comments
  FOR ALL USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Authenticated users can manage status logs" ON public.report_status_logs;
CREATE POLICY "Authenticated users can manage status logs" ON public.report_status_logs
  FOR ALL USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');

NOTIFY pgrst, 'reload schema';


-- ===== add-p8-equipment.sql 반영 (P8 설비 허용) =====
-- Add P8 (8000 ton press) as an actual-only production entry equipment.
--
-- Run this in the Supabase SQL Editor before using P8 in the app.
-- It is safe to rerun.

ALTER TABLE public.production_entries
  DROP CONSTRAINT IF EXISTS production_entries_equipment_check,
  ADD CONSTRAINT production_entries_equipment_check
    CHECK (equipment IN ('P15', 'P5', 'R/M', 'P8'));

