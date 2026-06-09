import supabase, { isDemoMode } from '../lib/supabase';
import {
  EquipmentTarget,
  ProductionEntry,
  ProductionPeriodTarget,
  ProductionReport,
  User,
} from '../types';

export type StorageMode = 'local' | 'supabase';

export interface PersistedReportState {
  reports: ProductionReport[];
  entries: ProductionEntry[];
  targets: EquipmentTarget[];
  periodTargets: ProductionPeriodTarget[];
  users: User[];
  currentUserId: string;
}

const STORAGE_KEY = 'forging-production-app:report-state:v1';

function getLocalStorage() {
  if (typeof window === 'undefined') return null;
  return window.localStorage;
}

export function getInitialStorageMode(): StorageMode {
  return isDemoMode ? 'local' : 'supabase';
}

export function loadLocalReportState(): Partial<PersistedReportState> | null {
  const storage = getLocalStorage();
  if (!storage) return null;

  try {
    const raw = storage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as Partial<PersistedReportState>;
  } catch (error) {
    console.warn('Failed to load local report state', error);
    return null;
  }
}

export function saveLocalReportState(state: PersistedReportState) {
  const storage = getLocalStorage();
  if (!storage) return;

  try {
    storage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (error) {
    console.warn('Failed to save local report state', error);
  }
}

function assertSupabase() {
  if (!supabase) {
    throw new Error('Supabase 환경변수가 없어 로컬 저장 모드로 동작합니다.');
  }
  return supabase;
}

async function ensureSupabaseSession(client: NonNullable<typeof supabase>) {
  const { data } = await client.auth.getSession();
  if (data.session) return;

  const { error } = await client.auth.signInAnonymously();
  if (error) {
    console.warn('Supabase anonymous sign-in failed. Falling back to existing access policy.', error);
  }
}

export async function loadSupabaseReportState(): Promise<Partial<PersistedReportState>> {
  const client = assertSupabase();
  await ensureSupabaseSession(client);
  const [users, reports, entries, targets, periodTargets] = await Promise.all([
    client.from('users').select('*').order('created_at', { ascending: true }),
    client.from('production_reports').select('*').order('report_date', { ascending: true }),
    client.from('production_entries').select('*').order('created_at', { ascending: true }),
    client.from('equipment_targets').select('*').order('created_at', { ascending: true }),
    client.from('production_period_targets').select('*').order('created_at', { ascending: true }),
  ]);

  const firstError = [users, reports, entries, targets, periodTargets].find(result => result.error)?.error;
  if (firstError) throw firstError;

  return {
    users: (users.data ?? []) as User[],
    reports: (reports.data ?? []) as ProductionReport[],
    entries: (entries.data ?? []) as ProductionEntry[],
    targets: (targets.data ?? []) as EquipmentTarget[],
    periodTargets: (periodTargets.data ?? []) as ProductionPeriodTarget[],
  };
}

export async function saveSupabaseReportState(state: PersistedReportState) {
  if (isDemoMode || !supabase) return;

  const client = assertSupabase();
  await ensureSupabaseSession(client);
  const operations = [
    state.users.length > 0
      ? client.from('users').upsert(state.users, { onConflict: 'id' })
      : Promise.resolve({ error: null }),
    state.reports.length > 0
      ? client.from('production_reports').upsert(state.reports, { onConflict: 'id' })
      : Promise.resolve({ error: null }),
    state.targets.length > 0
      ? client.from('equipment_targets').upsert(state.targets, { onConflict: 'id' })
      : Promise.resolve({ error: null }),
    state.periodTargets.length > 0
      ? client.from('production_period_targets').upsert(state.periodTargets, { onConflict: 'id' })
      : Promise.resolve({ error: null }),
    state.entries.length > 0
      ? client.from('production_entries').upsert(state.entries, { onConflict: 'id' })
      : Promise.resolve({ error: null }),
  ];

  const results = await Promise.all(operations);
  const firstError = results.find(result => result.error)?.error;
  if (firstError) throw firstError;
}

export function getStorageErrorMessage(error: unknown) {
  if (error instanceof Error) return error.message;
  return '저장소 동기화 중 알 수 없는 오류가 발생했습니다.';
}
