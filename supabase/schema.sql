-- ============================================================
-- 단조 생산 일일 보고 시스템 - Supabase 스키마
-- ============================================================

-- 유저 테이블
CREATE TABLE IF NOT EXISTS public.users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  employee_no TEXT UNIQUE,
  role TEXT NOT NULL CHECK (role IN ('admin', 'manager', 'user', 'viewer')),
  assigned_equipment TEXT[] DEFAULT '{}',
  assigned_shift TEXT CHECK (assigned_shift IN ('주간', '야간')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 생산 보고서 테이블
CREATE TABLE IF NOT EXISTS public.production_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  report_date DATE NOT NULL UNIQUE,
  next_plan_date DATE NOT NULL,
  status TEXT NOT NULL DEFAULT 'collecting'
    CHECK (status IN ('draft', 'collecting', 'submitted', 'reviewed', 'closed')),
  created_by UUID REFERENCES public.users(id),
  closed_by UUID REFERENCES public.users(id),
  closed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 생산 실적 입력 테이블
CREATE TABLE IF NOT EXISTS public.production_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id UUID NOT NULL REFERENCES public.production_reports(id) ON DELETE CASCADE,
  user_id UUID REFERENCES public.users(id),
  equipment TEXT NOT NULL CHECK (equipment IN ('P15', 'P5', 'R/M')),
  shift TEXT NOT NULL CHECK (shift IN ('주간', '야간')),
  product_plan INTEGER NOT NULL DEFAULT 0,
  product_actual INTEGER NOT NULL DEFAULT 0,
  billet_plan INTEGER NOT NULL DEFAULT 0,
  billet_actual INTEGER NOT NULL DEFAULT 0,
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
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  equipment TEXT NOT NULL CHECK (equipment IN ('P15', 'P5', 'R/M')),
  shift TEXT NOT NULL CHECK (shift IN ('주간', '야간')),
  product_target INTEGER NOT NULL DEFAULT 0,
  billet_target INTEGER NOT NULL DEFAULT 0,
  effective_date DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(equipment, shift, effective_date)
);

-- 보고서 코멘트 테이블
CREATE TABLE IF NOT EXISTS public.report_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id UUID NOT NULL REFERENCES public.production_reports(id) ON DELETE CASCADE,
  summary TEXT,
  manager_comment TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 보고서 상태 로그 테이블
CREATE TABLE IF NOT EXISTS public.report_status_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id UUID NOT NULL REFERENCES public.production_reports(id) ON DELETE CASCADE,
  user_id UUID REFERENCES public.users(id),
  status TEXT NOT NULL,
  memo TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 기본 목표값 INSERT
-- ============================================================
INSERT INTO public.equipment_targets (equipment, shift, product_target, billet_target, effective_date)
VALUES
  ('P15', '주간', 145000, 150000, '2026-01-01'),
  ('P15', '야간', 0, 0, '2026-01-01'),
  ('P5', '주간', 70000, 50000, '2026-01-01'),
  ('P5', '야간', 0, 0, '2026-01-01'),
  ('R/M', '주간', 200000, 0, '2026-01-01'),
  ('R/M', '야간', 0, 0, '2026-01-01')
ON CONFLICT DO NOTHING;

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

CREATE TRIGGER trigger_production_reports_updated_at
  BEFORE UPDATE ON public.production_reports
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

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
ALTER TABLE public.report_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.report_status_logs ENABLE ROW LEVEL SECURITY;

-- 모든 인증된 사용자: 조회 가능
CREATE POLICY "Users can view all data" ON public.production_reports
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Users can view entries" ON public.production_entries
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Users can view targets" ON public.equipment_targets
  FOR SELECT USING (auth.role() = 'authenticated');

-- 인증된 사용자: 본인 항목 수정 가능 (자세한 권한은 앱 레벨에서 처리)
CREATE POLICY "Authenticated users can insert entries" ON public.production_entries
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can update entries" ON public.production_entries
  FOR UPDATE USING (auth.role() = 'authenticated');
