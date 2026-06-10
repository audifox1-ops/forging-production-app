-- Add P8 (8000 ton press) as an actual-only production entry equipment.
--
-- Run this in the Supabase SQL Editor before using P8 in the app.
-- It is safe to rerun.

ALTER TABLE public.production_entries
  DROP CONSTRAINT IF EXISTS production_entries_equipment_check,
  ADD CONSTRAINT production_entries_equipment_check
    CHECK (equipment IN ('P15', 'P5', 'R/M', 'P8'));

UPDATE public.users
SET assigned_equipment = ARRAY(
  SELECT DISTINCT equipment
  FROM unnest(COALESCE(assigned_equipment, '{}'::text[]) || ARRAY['P8']) AS equipment
)
WHERE email IN ('admin@forging.com', 'hoegeun.kim@forging.com', 'eunseo.lee@forging.com');

UPDATE public.users
SET assigned_equipment = ARRAY(
  SELECT DISTINCT equipment
  FROM unnest(COALESCE(assigned_equipment, '{}'::text[]) || ARRAY['R/M', 'P8']) AS equipment
)
WHERE email = 'jaehan.woo@forging.com';

INSERT INTO public.production_entries (
  id,
  report_id,
  user_id,
  user_name,
  equipment,
  shift,
  product_plan,
  product_actual,
  billet_plan,
  billet_actual,
  next_product_plan,
  next_billet_plan,
  submit_status,
  created_at,
  updated_at
)
SELECT
  gen_random_uuid()::text,
  report.id,
  COALESCE((SELECT id FROM public.users WHERE email = 'jaehan.woo@forging.com' LIMIT 1), '55555555-5555-5555-5555-555555555555'),
  COALESCE((SELECT name FROM public.users WHERE email = 'jaehan.woo@forging.com' LIMIT 1), '우재한 과장'),
  'P8',
  shift_value.shift,
  0,
  0,
  0,
  0,
  0,
  0,
  'not_started',
  NOW(),
  NOW()
FROM public.production_reports report
CROSS JOIN (VALUES ('주간'), ('야간')) AS shift_value(shift)
ON CONFLICT (report_id, equipment, shift) DO NOTHING;

NOTIFY pgrst, 'reload schema';
