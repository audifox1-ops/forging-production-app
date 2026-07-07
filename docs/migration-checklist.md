# Forging Insight migration checklist

1. In the new Forging Insight Supabase project, run `supabase/migration_to_insight.sql` in the SQL Editor.
2. Copy `.env.migration.example` to `.env.migration`, fill the four keys, then run `node scripts/migrate-data.mjs` and confirm the row-count table matches.
3. Replace this app's `.env` and Vercel environment variables with the new Supabase project URL and anon key.
4. Redeploy to Vercel, keep the old project alive for 1-2 weeks as a rollback path, then retire it after validation.

## Notes

- `report_status_logs` is present in the legacy schema, but the app runtime does not use it, so it is intentionally left out of the migration script.
- Storage usage was grepped in the app source and no Supabase bucket usage was found.
