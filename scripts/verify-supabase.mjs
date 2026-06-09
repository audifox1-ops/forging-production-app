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
      throw new Error(`Read check failed for ${table}: ${error.message}`);
    }

    console.log(`read:${table}:ok count=${count ?? 'unknown'}`);
  }
}

async function verifyUserCrud(client) {
  const suffix = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const testUser = {
    id: `verify-${suffix}`,
    name: 'Supabase Verify',
    email: `verify-${suffix}@example.invalid`,
    employee_no: `verify-${suffix}`,
    role: 'viewer',
    assigned_equipment: [],
    assigned_shift: null,
    can_write: false,
    can_edit: false,
    can_delete: false,
    created_at: new Date().toISOString(),
  };

  try {
    const insertResult = await client.from('users').insert(testUser).select('id').single();
    if (insertResult.error) {
      throw new Error(`User insert failed: ${insertResult.error.message}`);
    }
    console.log(`crud:users:insert:ok id=${insertResult.data.id}`);

    const updateResult = await client
      .from('users')
      .update({ can_write: true })
      .eq('id', testUser.id)
      .select('id, can_write')
      .single();
    if (updateResult.error) {
      throw new Error(`User update failed: ${updateResult.error.message}`);
    }
    if (!updateResult.data.can_write) {
      throw new Error('User update check failed: can_write was not updated');
    }
    console.log('crud:users:update:ok');
  } finally {
    const deleteResult = await client.from('users').delete().eq('id', testUser.id);
    if (deleteResult.error) {
      throw new Error(`User cleanup failed: ${deleteResult.error.message}`);
    }
    console.log('crud:users:delete:ok');
  }
}

async function main() {
  ENV_FILES.forEach(loadEnvFile);
  const { supabaseUrl, supabaseAnonKey } = assertRequiredEnv();
  const client = createClient(supabaseUrl, supabaseAnonKey);

  await ensureAuthenticated(client);
  await verifyTableReads(client);
  await verifyUserCrud(client);

  console.log('supabase:verify:ok');
}

main().catch(error => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
