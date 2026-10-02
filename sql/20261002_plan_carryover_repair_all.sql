-- 2026-09-30 ~ 2026-10-01 전체 설비·교대 전일 계획 이월 보정
-- 이번 사고 범위의 미마감 보고서에서,
-- 직전 예상이 입력된 행은 직전 예상과 일치하도록 자동 이월한다.
-- 직전 예상이 0/0이면 조용히 이전 값을 복사하지 않는다.

BEGIN;

WITH stale_carryover AS (
  SELECT
    current_entry.id AS current_entry_id,
    previous_entry.next_product_plan,
    previous_entry.next_billet_plan
  FROM public.production_reports AS current_report
  JOIN public.production_entries AS current_entry
    ON current_entry.report_id = current_report.id
  JOIN LATERAL (
    SELECT previous_report.id, previous_report.report_date
    FROM public.production_reports AS previous_report
    WHERE previous_report.report_date < current_report.report_date
    ORDER BY previous_report.report_date DESC, previous_report.id DESC
    LIMIT 1
  ) AS previous_report ON TRUE
  JOIN public.production_entries AS previous_entry
    ON previous_entry.report_id = previous_report.id
   AND previous_entry.equipment = current_entry.equipment
   AND previous_entry.shift = current_entry.shift
  WHERE current_report.report_date IN ('2026-09-30', '2026-10-01')
    AND current_report.status <> 'reviewed'
    AND current_report.closed_at IS NULL
    AND (previous_entry.next_product_plan > 0 OR previous_entry.next_billet_plan > 0)
    AND (
      current_entry.product_plan <> previous_entry.next_product_plan
      OR current_entry.billet_plan <> previous_entry.next_billet_plan
      OR current_entry.plan_source IS DISTINCT FROM 'carried'
    )
)
UPDATE public.production_entries AS current_entry
SET product_plan = stale_carryover.next_product_plan,
    billet_plan = stale_carryover.next_billet_plan,
    plan_source = 'carried',
    updated_at = now()
FROM stale_carryover
WHERE current_entry.id = stale_carryover.current_entry_id;

NOTIFY pgrst, 'reload schema';

COMMIT;

-- 수동 롤백은 실행 전 대상 행을 백업한 뒤 운영자가 확인하여 적용하세요.
