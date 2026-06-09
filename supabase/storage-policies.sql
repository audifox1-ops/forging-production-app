-- Apply this after supabase/schema.sql when the app can read tables but cannot
-- save data through the authenticated Supabase REST role.
--
-- This script intentionally skips missing tables instead of failing with
-- SQLSTATE 42P01. It also refreshes the REST schema cache for PGRST205 write
-- errors. If a required table is skipped, run supabase/schema.sql first.

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
    IF to_regclass(format('public.%I', table_name)) IS NULL THEN
      RAISE NOTICE 'Skipping public.% because it does not exist. Run supabase/schema.sql first if this table is required.', table_name;
      CONTINUE;
    END IF;

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
    IF to_regclass(format('public.%I', policy_record.table_name)) IS NULL THEN
      RAISE NOTICE 'Skipping policy "%" because public.% does not exist.', policy_record.policy_name, policy_record.table_name;
      CONTINUE;
    END IF;

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
