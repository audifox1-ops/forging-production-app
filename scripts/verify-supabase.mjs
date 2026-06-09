#!/usr/bin/env node
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createClient } from '@supabase/supabase-js';

const ENV_FILES = ['.env.local', '.env'];
const CORE_TABLES = [
  'users',
  'production_reports',
  'production_entries',
  'equipment_targets',
  'production_period_targets',
  'report_comments',
  'report_status_logs',
];

function loadEnvFile(fileName) {
  const filePath = resolve(process.cwd(), fileName);
  if (!existsSync(filePath)) return;

  const lines = readFileSync(filePath, 'utf8').split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;

    const separator = trimmed.indexOf('=');
    if (separator === -1) continue;

    const key = trimmed.slice(0, separator).trim();
    let value = trimmed.slice(separator + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    if (!process.env[key]) {
      process.env[key] = value;
    }
  }
}

function assertRequiredEnv() {
  const supabaseUrl = process.env.VITE_SUPABASE_URL;
  const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error(
      'Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY. Add them to .env.local or the shell environment.'
    );
  }

  return { supabaseUrl, supabaseAnonKey };
}

async function ensureAuthenticated(client) {
  const { data } = await client.auth.getSession();
  if (data.session) return;

  const { error } = await client.auth.signInAnonymously();
  if (error) {
    throw new Error(`Supabase anonymous sign-in failed: ${error.message}`);
  }
}

async function verifyTableReads(client) {
  for (const table of CORE_TABLES) {
    const { error, count } = await client
      .from(table)
      .select('*', { count: 'exact', head: true });

    if (error) {
      throwSupabaseError(`Read check failed for ${table}`, error);
    }

    console.log(`read:${table}:ok count=${count ?? 'unknown'}`);
  }
}

function formatSupabaseError(error) {
  const details = [
    error.message,
    error.code ? `code=${error.code}` : '',
    error.details ? `details=${error.details}` : '',
    error.hint ? `hint=${error.hint}` : '',
  ].filter(Boolean);

  return details.join(' ');
}

function throwSupabaseError(label, error) {
  throw new Error(`${label}: ${formatSupabaseError(error)}`);
}

function assertNoSupabaseError(label, result) {
  if (result.error) {
    throwSupabaseError(label, result.error);
  }
}

function getFutureDate(offsetDays) {
  const date = new Date(Date.UTC(2100, 0, 1 + offsetDays));
  return date.toISOString().slice(0, 10);
}

async function verifyAppWrites(client) {
  const suffix = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const dateOffset = Math.floor(Math.random() * 20000);
  const reportDate = getFutureDate(dateOffset);
  const nextPlanDate = getFutureDate(dateOffset + 1);
  const targetDate = getFutureDate(dateOffset + 2);
  const now = new Date().toISOString();
  const testUser = {
    id: `verify-user-${suffix}`,
    name: 'Supabase Verify',
    email: `verify-${suffix}@example.invalid`,
    employee_no: `verify-${suffix}`,
    role: 'viewer',
    assigned_equipment: [],
    assigned_shift: null,
    can_write: false,
    can_edit: false,
    can_delete: false,
    created_at: now,
  };
  const testReport = {
    id: `verify-report-${suffix}`,
    report_date: reportDate,
    next_plan_date: nextPlanDate,
    status: 'collecting',
    created_by: testUser.id,
    created_at: now,
    updated_at: now,
  };
  const testTarget = {
    id: `verify-target-${suffix}`,
    equipment: 'P15',
    shift: '주간',
    product_target: 1,
    billet_target: 1,
    effective_date: targetDate,
    created_at: now,
  };
  const testPeriodTarget = {
    id: `verify-period-target-${suffix}`,
    period: 'weekly',
    product_target: 1,
    billet_target: 1,
    effective_date: targetDate,
    created_at: now,
  };
  const testEntry = {
    id: `verify-entry-${suffix}`,
    report_id: testReport.id,
    user_id: testUser.id,
    user_name: testUser.name,
    equipment: 'P15',
    shift: '주간',
    product_plan: 1,
    product_actual: 0,
    billet_plan: 1,
    billet_actual: 0,
    next_product_plan: 1,
    next_billet_plan: 1,
    product_achievement_rate: null,
    billet_achievement_rate: null,
    reason_category: null,
    reason_detail: null,
    action_today: null,
    recovery_plan: null,
    support_request: null,
    submit_status: 'not_started',
    submitted_at: null,
    created_at: now,
    updated_at: now,
  };
  const testComment = {
    id: `verify-comment-${suffix}`,
    report_id: testReport.id,
    summary: 'Supabase Verify',
    manager_comment: null,
    created_at: now,
    updated_at: now,
  };
  const testStatusLog = {
    id: `verify-status-log-${suffix}`,
    report_id: testReport.id,
    user_id: testUser.id,
    status: 'collecting',
    memo: 'Supabase Verify',
    created_at: now,
  };

  const insertedTables = [];
  try {
    for (const [table, record] of [
      ['users', testUser],
      ['production_reports', testReport],
      ['equipment_targets', testTarget],
      ['production_period_targets', testPeriodTarget],
      ['production_entries', testEntry],
      ['report_comments', testComment],
      ['report_status_logs', testStatusLog],
    ]) {
      const result = await client.from(table).upsert(record, { onConflict: 'id' });
      assertNoSupabaseError(`Write check failed for ${table}`, result);
      insertedTables.push([table, record.id]);
      console.log(`write:${table}:upsert:ok id=${record.id}`);
    }

    const updateResult = await client
      .from('users')
      .update({ can_write: true })
      .eq('id', testUser.id)
      .select('id, can_write')
      .single();
    assertNoSupabaseError('User update failed', updateResult);
    if (!updateResult.data.can_write) {
      throw new Error('User update check failed: can_write was not updated');
    }
    console.log('write:users:update:ok');
  } finally {
    for (const [table, id] of insertedTables.reverse()) {
      const deleteResult = await client.from(table).delete().eq('id', id);
      assertNoSupabaseError(`Cleanup failed for ${table}`, deleteResult);
      console.log(`write:${table}:delete:ok id=${id}`);
    }
  }
}

async function main() {
  ENV_FILES.forEach(loadEnvFile);
  const { supabaseUrl, supabaseAnonKey } = assertRequiredEnv();
  const client = createClient(supabaseUrl, supabaseAnonKey);

  await ensureAuthenticated(client);
  await verifyTableReads(client);
  await verifyAppWrites(client);

  console.log('supabase:verify:ok');
}

main().catch(error => {
  console.error(error instanceof Error ? error.message : error);
  console.error(
    'If this mentions SQLSTATE 42P01 or schema cache, run supabase/fix-42p01.sql in the Supabase SQL Editor, then rerun this verifier.'
  );
  process.exit(1);
});
