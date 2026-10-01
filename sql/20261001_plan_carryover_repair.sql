-- 2026-10-01 P5 주간 전일 계획 이월 보정
-- 원인: 직전 예상 입력 전에 후속 보고서가 생성되어 fallback/0으로 저장되었으나,
--       운영 보정 SQL에서 해당 행이 manual로 잘못 분류되어 자동 갱신되지 않음.
-- 실행 전 대상 행을 확인하고 운영자 승인 후 실행하세요.

BEGIN;

-- 9/30은 9/29 P5 주간 금일 예상(40,374 / 0)을 이월한다.
UPDATE public.production_entries AS current_entry
SET product_plan = previous_entry.next_product_plan,
    billet_plan = previous_entry.next_billet_plan,
    plan_source = 'carried',
    updated_at = now()
FROM public.production_reports AS current_report
JOIN public.production_reports AS previous_report
  ON previous_report.report_date = '2026-09-29'
JOIN public.production_entries AS previous_entry
  ON previous_entry.report_id = previous_report.id
 AND previous_entry.equipment = 'P5'
 AND previous_entry.shift = '주간'
WHERE current_entry.report_id = current_report.id
  AND current_report.report_date = '2026-09-30'
  AND current_entry.equipment = 'P5'
  AND current_entry.shift = '주간'
  AND current_report.status <> 'reviewed'
  AND current_report.closed_at IS NULL;

-- 10/1은 보정된 9/30 P5 주간 금일 예상(12,082 / 15,268)을 이월한다.
UPDATE public.production_entries AS current_entry
SET product_plan = previous_entry.next_product_plan,
    billet_plan = previous_entry.next_billet_plan,
    plan_source = 'carried',
    updated_at = now()
FROM public.production_reports AS current_report
JOIN public.production_reports AS previous_report
  ON previous_report.report_date = '2026-09-30'
JOIN public.production_entries AS previous_entry
  ON previous_entry.report_id = previous_report.id
 AND previous_entry.equipment = 'P5'
 AND previous_entry.shift = '주간'
WHERE current_entry.report_id = current_report.id
  AND current_report.report_date = '2026-10-01'
  AND current_entry.equipment = 'P5'
  AND current_entry.shift = '주간'
  AND current_report.status <> 'reviewed'
  AND current_report.closed_at IS NULL;

NOTIFY pgrst, 'reload schema';

COMMIT;

-- 수동 롤백 예시: 실행 전 값을 별도 기록한 뒤 운영자가 확인하여 적용하세요.
-- BEGIN;
-- UPDATE public.production_entries
-- SET product_plan = 26684, billet_plan = 13024, plan_source = 'manual'
-- WHERE report_id = (SELECT id FROM public.production_reports WHERE report_date = '2026-09-30')
--   AND equipment = 'P5' AND shift = '주간';
-- UPDATE public.production_entries
-- SET product_plan = 0, billet_plan = 0, plan_source = 'manual'
-- WHERE report_id = (SELECT id FROM public.production_reports WHERE report_date = '2026-10-01')
--   AND equipment = 'P5' AND shift = '주간';
-- COMMIT;
