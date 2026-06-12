import supabase, { isDemoMode } from '../lib/supabase';
import {
  EquipmentTarget,
  ProductionEntry,
  ProductionPeriodTarget,
  ReportComment,
  ProductionReport,
  TemplateWorkbookSheet,
  User,
} from '../types';

export type StorageMode = 'local' | 'supabase';

export interface PersistedReportState {
  reports: ProductionReport[];
  entries: ProductionEntry[];
  targets: EquipmentTarget[];
  periodTargets: ProductionPeriodTarget[];
  templateSheets: TemplateWorkbookSheet[];
  users: User[];
  currentUserId: string;
}

export type SupabaseTableName =
  | 'users'
  | 'production_reports'
  | 'production_entries'
  | 'equipment_targets'
  | 'production_period_targets'
  | 'report_comments';

type SupabaseRow =
  | User
  | ProductionReport
  | ProductionEntry
  | EquipmentTarget
  | ProductionPeriodTarget
  | ReportComment;

const STORAGE_KEY = 'forging-production-app:report-state:v1';
const P8_COMMENT_TYPE = 'p8-production-entry';
const TEMPLATE_WORKBOOK_COMMENT_TYPE = 'template-workbook-sheet';

export const TEMPLATE_WORKBOOK_ANCHOR_REPORT_ID = 'template-workbook-anchor';

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
    const isQuotaError = error instanceof DOMException && error.name === 'QuotaExceededError';
    if (isQuotaError) {
      console.warn('localStorage 용량이 초과되었습니다. 브라우저 저장 공간을 확보해주세요.', error);
    } else {
      console.warn('Failed to save local report state', error);
    }
  }
}

function assertSupabase() {
  if (!supabase) {
    throw new Error('Supabase 환경변수가 없어 서버 공유 저장을 사용할 수 없습니다.');
  }
  return supabase;
}

function isP8Entry(row: SupabaseRow): row is ProductionEntry {
  return 'equipment' in row && row.equipment === 'P8';
}

function getP8CommentId(entry: ProductionEntry) {
  return `p8-entry-${entry.report_id}-${entry.shift}`;
}

function serializeP8Entry(entry: ProductionEntry) {
  return JSON.stringify({ type: P8_COMMENT_TYPE, entry });
}

function parseP8EntryComment(comment: ReportComment): ProductionEntry | null {
  try {
    const payload = JSON.parse(comment.summary);
    if (payload?.type !== P8_COMMENT_TYPE || payload?.entry?.equipment !== 'P8') return null;
    return payload.entry as ProductionEntry;
  } catch {
    return null;
  }
}

function toP8EntryComment(entry: ProductionEntry): ReportComment {
  return {
    id: getP8CommentId(entry),
    report_id: entry.report_id,
    summary: serializeP8Entry(entry),
    created_at: entry.created_at,
    updated_at: entry.updated_at,
  };
}

export function isTemplateWorkbookAnchorReport(report: Pick<ProductionReport, 'id'>) {
  return report.id === TEMPLATE_WORKBOOK_ANCHOR_REPORT_ID;
}

function serializeTemplateWorkbookSheet(sheet: TemplateWorkbookSheet) {
  return JSON.stringify({ type: TEMPLATE_WORKBOOK_COMMENT_TYPE, sheet });
}

function parseTemplateWorkbookSheetComment(comment: ReportComment): TemplateWorkbookSheet | null {
  try {
    const payload = JSON.parse(comment.summary);
    if (payload?.type !== TEMPLATE_WORKBOOK_COMMENT_TYPE || !payload.sheet?.sheet_name) return null;
    return payload.sheet as TemplateWorkbookSheet;
  } catch {
    return null;
  }
}

function getTemplateWorkbookSheetOrder(sheet: TemplateWorkbookSheet) {
  const monthlyMatch = /^(\d{2})(\d{2})월$/.exec(sheet.sheet_name);
  if (monthlyMatch) return Number(monthlyMatch[1]) * 100 + Number(monthlyMatch[2]);
  if (sheet.sheet_name === '2025년 전체') return 202500;
  if (sheet.sheet_name === '2026년 전체') return 202600;
  return 999999;
}

function parseTemplateWorkbookSheets(comments: ReportComment[]) {
  return comments
    .map(parseTemplateWorkbookSheetComment)
    .filter((sheet): sheet is TemplateWorkbookSheet => Boolean(sheet))
    .sort((a, b) => getTemplateWorkbookSheetOrder(a) - getTemplateWorkbookSheetOrder(b));
}

function toTemplateWorkbookSheetComment(sheet: TemplateWorkbookSheet): ReportComment {
  return {
    id: `template-workbook-sheet-${sheet.id}`,
    report_id: TEMPLATE_WORKBOOK_ANCHOR_REPORT_ID,
    summary: serializeTemplateWorkbookSheet(sheet),
    created_at: sheet.imported_at,
    updated_at: sheet.imported_at,
  };
}

function splitP8Entries(rows: SupabaseRow[]) {
  const p8Entries: ProductionEntry[] = [];
  const regularRows: SupabaseRow[] = [];

  rows.forEach(row => {
    if (isP8Entry(row)) {
      p8Entries.push(row);
    } else {
      regularRows.push(row);
    }
  });

  return { regularRows, p8Entries };
}

function mergeP8Entries(entries: ProductionEntry[], comments: ReportComment[]) {
  const byKey = new Map<string, ProductionEntry>();
  entries.forEach(entry => {
    byKey.set(`${entry.report_id}-${entry.equipment}-${entry.shift}`, entry);
  });
  comments
    .map(parseP8EntryComment)
    .filter((entry): entry is ProductionEntry => Boolean(entry))
    .forEach(entry => {
      byKey.set(`${entry.report_id}-${entry.equipment}-${entry.shift}`, entry);
    });
  return Array.from(byKey.values());
}

async function ensureSupabaseSession(client: NonNullable<typeof supabase>) {
  const { data } = await client.auth.getSession();
  if (data.session) return;

  const { error } = await client.auth.signInAnonymously();
  if (error) {
    console.warn('Supabase anonymous sign-in failed. Falling back to existing access policy.', error);
  }
}

async function fetchAll<T>(client: NonNullable<typeof supabase>, table: string): Promise<T[]> {
  let allData: T[] = [];
  let from = 0;
  const step = 1000;
  
  while (true) {
    const { data, error } = await client
      .from(table)
      .select('*')
      .order('created_at', { ascending: true })
      .range(from, from + step - 1);
      
    if (error) throw error;
    if (!data || data.length === 0) break;
    
    allData = allData.concat(data);
    if (data.length < step) break;
    from += step;
  }
  return allData;
}

export async function loadSupabaseReportState(): Promise<Partial<PersistedReportState>> {
  const client = assertSupabase();
  await ensureSupabaseSession(client);
  
  const [users, reports, entries, targets, periodTargets, comments] = await Promise.all([
    fetchAll<User>(client, 'users'),
    fetchAll<ProductionReport>(client, 'production_reports'),
    fetchAll<ProductionEntry>(client, 'production_entries'),
    fetchAll<EquipmentTarget>(client, 'equipment_targets'),
    fetchAll<ProductionPeriodTarget>(client, 'production_period_targets'),
    fetchAll<ReportComment>(client, 'report_comments'),
  ]);

  return {
    users: users,
    reports: reports.filter(report => !isTemplateWorkbookAnchorReport(report)),
    entries: mergeP8Entries(
      entries,
      comments
    ),
    targets: targets,
    periodTargets: periodTargets,
    templateSheets: parseTemplateWorkbookSheets(comments),
  };
}

export async function saveSupabaseReportState(state: PersistedReportState) {
  if (isDemoMode || !supabase) return;

  const client = assertSupabase();
  await ensureSupabaseSession(client);
  const { regularRows: regularEntries, p8Entries } = splitP8Entries(state.entries);
  const p8Comments = p8Entries.map(toP8EntryComment);
  const templateSheetComments = state.templateSheets.map(toTemplateWorkbookSheetComment);
  const operations = [
    state.users.length > 0
      ? client.from('users').upsert(state.users, { onConflict: 'id' })
      : Promise.resolve({ error: null }),
    state.reports.length > 0
      ? client.from('production_reports').upsert(state.reports, { onConflict: 'id' })
      : Promise.resolve({ error: null }),
    state.targets.length > 0
      ? client.from('equipment_targets').upsert(state.targets, { onConflict: 'equipment,shift,effective_date' })
      : Promise.resolve({ error: null }),
    state.periodTargets.length > 0
      ? client.from('production_period_targets').upsert(state.periodTargets, { onConflict: 'period,effective_date' })
      : Promise.resolve({ error: null }),
    regularEntries.length > 0
      ? client.from('production_entries').upsert(regularEntries as ProductionEntry[], { onConflict: 'report_id,equipment,shift' })
      : Promise.resolve({ error: null }),
    p8Comments.length > 0
      ? client.from('report_comments').upsert(p8Comments, { onConflict: 'id' })
      : Promise.resolve({ error: null }),
    templateSheetComments.length > 0
      ? client.from('report_comments').upsert(templateSheetComments, { onConflict: 'id' })
      : Promise.resolve({ error: null }),
  ];

  const results = await Promise.all(operations);
  const firstError = results.find(result => result.error)?.error;
  if (firstError) throw firstError;
}

async function runSupabaseMutation(
  operation: (client: NonNullable<typeof supabase>) => PromiseLike<{ error: unknown }>
) {
  if (isDemoMode || !supabase) return;

  const client = assertSupabase();
  await ensureSupabaseSession(client);

  const { error } = await operation(client);
  if (error) throw error;
}

export async function upsertSupabaseRows(table: SupabaseTableName, rows: SupabaseRow | SupabaseRow[] | undefined) {
  if (!rows) return;

  const records = Array.isArray(rows) ? rows : [rows];
  if (records.length === 0) return;

  if (table === 'production_entries') {
    const { regularRows, p8Entries } = splitP8Entries(records);
    const p8Comments = p8Entries.map(toP8EntryComment);

    await runSupabaseMutation(async client => {
      const results = await Promise.all([
        regularRows.length > 0
          ? client.from('production_entries').upsert(regularRows as ProductionEntry[], { onConflict: 'report_id,equipment,shift' })
          : Promise.resolve({ error: null }),
        p8Comments.length > 0
          ? client.from('report_comments').upsert(p8Comments, { onConflict: 'id' })
          : Promise.resolve({ error: null }),
      ]);
      return { error: results.find(result => result.error)?.error ?? null };
    });
    return;
  }

  if (table === 'equipment_targets') {
    await runSupabaseMutation(client => client.from(table).upsert(records as EquipmentTarget[], { onConflict: 'equipment,shift,effective_date' }));
    return;
  }

  if (table === 'production_period_targets') {
    await runSupabaseMutation(client => client.from(table).upsert(records as ProductionPeriodTarget[], { onConflict: 'period,effective_date' }));
    return;
  }

  await runSupabaseMutation(client => client.from(table).upsert(records as User[], { onConflict: 'id' }));
}

export async function deleteSupabaseRows(table: SupabaseTableName, ids: string | string[]) {
  const targetIds = Array.isArray(ids) ? ids : [ids];
  if (targetIds.length === 0) return;

  await runSupabaseMutation(client => client.from(table).delete().in('id', targetIds));
}

export function isSupabaseSchemaError(error: unknown) {
  const message =
    error instanceof Error
      ? error.message
      : typeof error === 'object' && error !== null && 'message' in error
        ? String((error as { message?: unknown }).message)
        : '';
  const code =
    typeof error === 'object' && error !== null && 'code' in error
      ? String((error as { code?: unknown }).code)
      : '';

  return (
    code === '42P01' ||
    code === 'PGRST205' ||
    /schema cache|could not find the table|relation .* does not exist/i.test(message)
  );
}

function getSupabaseErrorCode(error: unknown) {
  return typeof error === 'object' && error !== null && 'code' in error
    ? String((error as { code?: unknown }).code)
    : '';
}

function getErrorMessage(error: unknown) {
  if (error instanceof Error) return error.message;
  return typeof error === 'object' && error !== null && 'message' in error
    ? String((error as { message?: unknown }).message)
    : '';
}

export function getStorageErrorMessage(error: unknown) {
  const message = getErrorMessage(error);
  const code = getSupabaseErrorCode(error);

  if (isSupabaseSchemaError(error)) {
    return `Supabase 테이블을 찾을 수 없습니다${code ? ` (${code})` : ''}. Supabase SQL Editor에서 supabase/fix-42p01.sql을 실행하세요. 서버 공유 저장이 복구될 때까지 다른 자리와 데이터가 공유되지 않을 수 있습니다.`;
  }

  if (
    code === '23514' &&
    /production_entries_equipment_check|violates check constraint/i.test(message)
  ) {
    return 'Supabase가 아직 P8 실적 저장을 허용하지 않습니다. Supabase SQL Editor에서 supabase/add-p8-equipment.sql을 실행한 뒤 다시 저장하세요.';
  }

  return `공유 저장 오류 상세 정보: ${JSON.stringify(error, null, 2)}`;
}
