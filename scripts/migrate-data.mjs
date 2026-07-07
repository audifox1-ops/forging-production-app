#!/usr/bin/env node
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createClient } from '@supabase/supabase-js';

const ENV_FILE = '.env.migration';
const PAGE_SIZE = 1000;
const TABLE_ORDER = [
  'users',
  'production_reports',
  'production_entries',
  'equipment_targets',
  'production_period_targets',
  'report_comments',
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
  const required = [
    'OLD_SUPABASE_URL',
    'OLD_SERVICE_ROLE_KEY',
    'NEW_SUPABASE_URL',
    'NEW_SERVICE_ROLE_KEY',
  ];

  const missing = required.filter(key => !process.env[key]);
  if (missing.length > 0) {
    throw new Error(
      `Missing required env vars: ${missing.join(', ')}. Copy .env.migration.example to .env.migration and fill all four values.`
    );
  }

  return {
    oldSupabaseUrl: process.env.OLD_SUPABASE_URL,
    oldServiceRoleKey: process.env.OLD_SERVICE_ROLE_KEY,
    newSupabaseUrl: process.env.NEW_SUPABASE_URL,
    newServiceRoleKey: process.env.NEW_SERVICE_ROLE_KEY,
  };
}

function createSupabaseClient(url, key) {
  return createClient(url, key, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
      detectSessionInUrl: false,
    },
  });
}

function formatSupabaseError(error) {
  const details = [
    error?.message,
    error?.code ? `code=${error.code}` : '',
    error?.details ? `details=${error.details}` : '',
    error?.hint ? `hint=${error.hint}` : '',
  ].filter(Boolean);

  return details.join(' ');
}

function assertNoSupabaseError(label, result) {
  if (result.error) {
    throw new Error(`${label}: ${formatSupabaseError(result.error)}`);
  }
}

function chunkRows(rows, size) {
  const chunks = [];
  for (let index = 0; index < rows.length; index += size) {
    chunks.push(rows.slice(index, index + size));
  }
  return chunks;
}

function normalizeRow(table, row) {
  if (table === 'production_reports') {
    const { closed_by, closed_at, ...rest } = row;
    const status = rest.status === 'closed' ? 'reviewed' : rest.status;
    return { ...rest, status };
  }

  return row;
}

async function fetchAllRows(client, table) {
  const rows = [];
  let from = 0;

  while (true) {
    const { data, error } = await client
      .from(table)
      .select('*')
      .order('id', { ascending: true })
      .range(from, from + PAGE_SIZE - 1);

    assertNoSupabaseError(`Read failed for ${table}`, { error });

    if (!data || data.length === 0) break;

    rows.push(...data);
    if (data.length < PAGE_SIZE) break;
    from += PAGE_SIZE;
  }

  return rows;
}

async function upsertRows(client, table, rows) {
  for (const batch of chunkRows(rows, PAGE_SIZE)) {
    if (batch.length === 0) continue;

    const { error } = await client.from(table).upsert(batch, { onConflict: 'id' });
    assertNoSupabaseError(`Write failed for ${table}`, { error });
  }
}

async function copyTable(sourceClient, targetClient, table) {
  const sourceRows = await fetchAllRows(sourceClient, table);
  const normalizedRows = sourceRows.map(row => normalizeRow(table, row));
  await upsertRows(targetClient, table, normalizedRows);
  console.log(`copy:${table}:rows=${sourceRows.length}`);
}

async function countRows(client, table) {
  const { count, error } = await client
    .from(table)
    .select('*', { count: 'exact', head: true });
  assertNoSupabaseError(`Count failed for ${table}`, { error });
  return count ?? 0;
}

async function main() {
  loadEnvFile(ENV_FILE);
  const {
    oldSupabaseUrl,
    oldServiceRoleKey,
    newSupabaseUrl,
    newServiceRoleKey,
  } = assertRequiredEnv();

  const sourceClient = createSupabaseClient(oldSupabaseUrl, oldServiceRoleKey);
  const targetClient = createSupabaseClient(newSupabaseUrl, newServiceRoleKey);

  console.log('Starting data migration from old Supabase to Forging Insight Supabase...');

  for (const table of TABLE_ORDER) {
    await copyTable(sourceClient, targetClient, table);
  }

  const comparison = [];
  let hasMismatch = false;

  for (const table of TABLE_ORDER) {
    const [sourceCount, targetCount] = await Promise.all([
      countRows(sourceClient, table),
      countRows(targetClient, table),
    ]);
    const match = sourceCount === targetCount;
    comparison.push({
      table,
      sourceCount,
      targetCount,
      status: match ? 'MATCH' : 'MISMATCH',
    });
    if (!match) hasMismatch = true;
  }

  console.table(comparison);

  if (hasMismatch) {
    throw new Error('Row count mismatch detected. Review the table above before switching traffic.');
  }

  console.log('Data migration verification passed.');
}

main().catch(error => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
