-- 전일 계획 이월 출처 추적 및 기존 데이터 분류
-- 이 파일은 앱에서 자동 실행하지 않습니다. 운영자가 검토 후 수동 실행하세요.

BEGIN;

ALTER TABLE public.production_entries
  ADD COLUMN IF NOT EXISTS plan_source TEXT NOT NULL DEFAULT 'manual';

ALTER TABLE public.production_entries
  DROP CONSTRAINT IF EXISTS production_entries_plan_source_check;

ALTER TABLE public.production_entries
  ADD CONSTRAINT production_entries_plan_source_check
  CHECK (plan_source IN ('carried', 'manual', 'unavailable'));

-- 기존 행은 직전 보고서의 예상값과 현재 전일 계획이 모두 일치할 때만
-- 자동 이월(carried)로 분류합니다. 그 외에는 사람이 입력했을 가능성이
-- 있으므로 manual로 보존합니다. 기존 스키마에서는 0이 미입력인지 실제
-- 계획인지 구분할 수 없으므로, 0이 포함된 행도 manual로 분류합니다.
WITH predecessor AS (
  SELECT
    current_entry.id,
    previous_entry.next_product_plan,
    previous_entry.next_billet_plan
  FROM public.production_entries AS current_entry
  JOIN public.production_reports AS current_report
    ON current_report.id = current_entry.report_id
  LEFT JOIN LATERAL (
    SELECT previous_entry.next_product_plan, previous_entry.next_billet_plan
    FROM public.production_reports AS previous_report
    JOIN public.production_entries AS previous_entry
      ON previous_entry.report_id = previous_report.id
     AND previous_entry.equipment = current_entry.equipment
     AND previous_entry.shift = current_entry.shift
    WHERE previous_report.report_date < current_report.report_date
    ORDER BY previous_report.report_date DESC, previous_report.id DESC
    LIMIT 1
  ) AS previous_entry ON TRUE
)
UPDATE public.production_entries AS current_entry
SET plan_source = CASE
  WHEN predecessor.next_product_plan > 0
   AND predecessor.next_billet_plan > 0
   AND current_entry.product_plan = predecessor.next_product_plan
   AND current_entry.billet_plan = predecessor.next_billet_plan
    THEN 'carried'
  ELSE 'manual'
END
FROM predecessor
WHERE current_entry.id = predecessor.id;

NOTIFY pgrst, 'reload schema';

COMMIT;

-- 수동 롤백 SQL (필요할 때만 별도로 실행)
-- BEGIN;
-- ALTER TABLE public.production_entries
--   DROP CONSTRAINT IF EXISTS production_entries_plan_source_check;
-- ALTER TABLE public.production_entries
--   DROP COLUMN IF EXISTS plan_source;
-- NOTIFY pgrst, 'reload schema';
-- COMMIT;
