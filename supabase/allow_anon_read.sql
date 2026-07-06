-- ============================================================================
-- allow_anon_read.sql — 생산일보를 "로그인 없이 조회, 로그인 시에만 수정"으로 전환
--
-- 배경: 부서원은 로그인 없이 일보를 볼 수 있어야 하고, 입력·수정은
--       관리자(로그인 계정)만 하기로 결정 (2026-07 운영 방침).
-- 효과: 아래 생산일보 테이블 7개에만 익명(anon) SELECT를 허용한다.
--       INSERT/UPDATE/DELETE는 기존대로 authenticated 전용 — 익명 수정 불가.
-- 중요: Forging Insight의 분석 테이블 16종에는 어떤 권한도 부여하지 않는다.
--       (스키마 전체 GRANT를 쓰지 않고 테이블을 하나씩 지정하는 이유)
-- 유의: users 테이블에는 부서원 이름·이메일이 있어 함께 공개된다.
--       (앱이 작성자 표시에 사용하므로 포함 — 원치 않으면 이 파일에서
--        users 관련 3줄을 지우고 실행)
-- 실행: 새(Forging Insight) Supabase의 SQL Editor에서 1회 실행. 재실행 안전.
-- ============================================================================

-- 익명 역할이 public 스키마에 접근할 수 있어야 개별 테이블 권한이 작동한다
GRANT USAGE ON SCHEMA public TO anon;

-- 생산일보 테이블 7개에만 SELECT 권한 부여 (테이블 단위 지정 — 전체 GRANT 금지)
GRANT SELECT ON public.users TO anon;
GRANT SELECT ON public.production_reports TO anon;
GRANT SELECT ON public.production_entries TO anon;
GRANT SELECT ON public.equipment_targets TO anon;
GRANT SELECT ON public.production_period_targets TO anon;
GRANT SELECT ON public.report_comments TO anon;
GRANT SELECT ON public.report_status_logs TO anon;

-- RLS 정책: 익명 조회 허용 (쓰기 정책은 기존 authenticated 전용 그대로 유지)
DROP POLICY IF EXISTS "Anon can view users" ON public.users;
CREATE POLICY "Anon can view users" ON public.users FOR SELECT TO anon USING (true);

DROP POLICY IF EXISTS "Anon can view reports" ON public.production_reports;
CREATE POLICY "Anon can view reports" ON public.production_reports FOR SELECT TO anon USING (true);

DROP POLICY IF EXISTS "Anon can view entries" ON public.production_entries;
CREATE POLICY "Anon can view entries" ON public.production_entries FOR SELECT TO anon USING (true);

DROP POLICY IF EXISTS "Anon can view targets" ON public.equipment_targets;
CREATE POLICY "Anon can view targets" ON public.equipment_targets FOR SELECT TO anon USING (true);

DROP POLICY IF EXISTS "Anon can view period targets" ON public.production_period_targets;
CREATE POLICY "Anon can view period targets" ON public.production_period_targets FOR SELECT TO anon USING (true);

DROP POLICY IF EXISTS "Anon can view comments" ON public.report_comments;
CREATE POLICY "Anon can view comments" ON public.report_comments FOR SELECT TO anon USING (true);

DROP POLICY IF EXISTS "Anon can view status logs" ON public.report_status_logs;
CREATE POLICY "Anon can view status logs" ON public.report_status_logs FOR SELECT TO anon USING (true);

NOTIFY pgrst, 'reload schema';
