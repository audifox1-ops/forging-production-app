-- Apply this after supabase/schema.sql when the app can read tables but cannot
-- save data through the authenticated Supabase REST role.

GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO authenticated;

DROP POLICY IF EXISTS "Authenticated users can manage users" ON public.users;
CREATE POLICY "Authenticated users can manage users" ON public.users
  FOR ALL USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Authenticated users can manage reports" ON public.production_reports;
CREATE POLICY "Authenticated users can manage reports" ON public.production_reports
  FOR ALL USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Authenticated users can manage entries" ON public.production_entries;
CREATE POLICY "Authenticated users can manage entries" ON public.production_entries
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

DROP POLICY IF EXISTS "Authenticated users can manage comments" ON public.report_comments;
CREATE POLICY "Authenticated users can manage comments" ON public.report_comments
  FOR ALL USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Authenticated users can manage status logs" ON public.report_status_logs;
CREATE POLICY "Authenticated users can manage status logs" ON public.report_status_logs
  FOR ALL USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');

NOTIFY pgrst, 'reload schema';
