import { describe, expect, it } from 'vitest';
import { DEMO_PERIOD_TARGETS, DEMO_TARGETS, DEMO_USERS } from '../src/lib/mockData';
import { useReportStore } from '../src/store/reportStore';
import { createMonthlyTemplateSheet, getCellMap } from '../src/utils/templateWorkbook';
import type { ProductionEntry, ProductionReport } from '../src/types';

const report = (id: string, reportDate: string, status: ProductionReport['status'] = 'collecting', nextPlanDate = reportDate): ProductionReport => ({
  id,
  report_date: reportDate,
  next_plan_date: nextPlanDate,
  status,
  created_by: 'user-admin',
  created_at: '2026-06-01T00:00:00Z',
  updated_at: '2026-06-01T00:00:00Z',
});

const entry = (overrides: Partial<ProductionEntry>): ProductionEntry => ({
  id: 'entry-1',
  report_id: 'report-1',
  user_id: 'user-admin',
  user_name: '관리자',
  equipment: 'P15',
  shift: '주간',
  product_plan: 0,
  product_actual: 0,
  billet_plan: 0,
  billet_actual: 0,
  next_product_plan: 0,
  next_billet_plan: 0,
  submit_status: 'not_started',
  created_at: '2026-06-01T00:00:00Z',
  updated_at: '2026-06-01T00:00:00Z',
  ...overrides,
});

const resetStore = (reports: ProductionReport[] = [], entries: ProductionEntry[] = []) => {
  useReportStore.setState({
    reports,
    entries,
    targets: DEMO_TARGETS,
    periodTargets: DEMO_PERIOD_TARGETS,
    templateSheets: [createMonthlyTemplateSheet(2026, 6)],
    users: DEMO_USERS,
    currentUserId: 'user-admin',
    storageMode: 'local',
    hasHydrated: true,
    isHydrating: false,
    syncError: undefined,
    lastSyncedAt: undefined,
    planCarryoverWarnings: {},
  });
};

describe('reportStore report creation', () => {
  it('syncs the new report into the production aggregation sheets', () => {
    resetStore();

    useReportStore.getState().createReport('2026-06-02');

    const rows = useReportStore.getState().templateSheets[0].rows;
    const actualRow = rows.find(row => row.row_date === '2026-06-02');
    const planRow = rows.find(row => row.row_date === '2026-06-04');
    expect(actualRow).toBeDefined();
    expect(planRow).toBeDefined();
    expect(getCellMap(actualRow!).B.value).toBe(0);
    expect(getCellMap(planRow!).C.value).toBeGreaterThan(0);
  });

  it('carries the predecessor expected plan and records carried source', () => {
    resetStore(
      [report('source', '2026-06-01')],
      [entry({
        report_id: 'source',
        next_product_plan: 37036,
        next_billet_plan: 12788,
      })]
    );

    const created = useReportStore.getState().createReport('2026-06-02');
    const createdEntry = useReportStore.getState().getEntriesByReport(created.id)[0];

    expect(createdEntry.product_plan).toBe(37036);
    expect(createdEntry.billet_plan).toBe(12788);
    expect(createdEntry.plan_source).toBe('carried');
  });

  it('updates only carried successor plans when the predecessor expected plan changes', () => {
    resetStore(
      [report('source', '2026-06-01', 'collecting', '2026-06-02'), report('successor', '2026-06-02')],
      [
        entry({ id: 'source-entry', report_id: 'source', next_product_plan: 37036 }),
        entry({ id: 'carried-entry', report_id: 'successor', plan_source: 'carried', product_plan: 37036 }),
        entry({ id: 'manual-entry', report_id: 'successor', plan_source: 'manual', product_plan: 213615, shift: '야간' }),
      ]
    );

    useReportStore.getState().saveEntry({
      id: 'source-entry',
      report_id: 'source',
      user_id: 'user-admin',
      equipment: 'P15',
      shift: '주간',
      next_product_plan: 42000,
    });

    const successorEntries = useReportStore.getState().getEntriesByReport('successor');
    expect(successorEntries.find(item => item.id === 'carried-entry')?.product_plan).toBe(42000);
    expect(successorEntries.find(item => item.id === 'manual-entry')?.product_plan).toBe(213615);
  });

  it('does not propagate into a reviewed successor report', () => {
    resetStore(
      [report('source', '2026-06-01', 'collecting', '2026-06-02'), report('successor', '2026-06-02', 'reviewed')],
      [
        entry({ id: 'source-entry', report_id: 'source', next_product_plan: 37036 }),
        entry({ id: 'successor-entry', report_id: 'successor', plan_source: 'carried', product_plan: 37036 }),
      ]
    );

    useReportStore.getState().saveEntry({
      id: 'source-entry',
      report_id: 'source',
      user_id: 'user-admin',
      equipment: 'P15',
      shift: '주간',
      next_product_plan: 42000,
    });

    expect(useReportStore.getState().getEntriesByReport('successor')[0].product_plan).toBe(37036);
  });

  it('does not copy an older report when the immediate predecessor expected plan is unavailable', () => {
    resetStore(
      [report('older', '2026-05-30'), report('source', '2026-06-01', 'collecting', '2026-06-02')],
      [
        entry({ id: 'older-entry', report_id: 'older', next_product_plan: 99999 }),
        entry({ id: 'source-entry', report_id: 'source', next_product_plan: 0, next_billet_plan: 0 }),
      ]
    );

    const created = useReportStore.getState().createReport('2026-06-02');
    const createdEntry = useReportStore.getState().getEntriesByReport(created.id)[0];

    expect(createdEntry.product_plan).toBe(0);
    expect(createdEntry.plan_source).toBe('unavailable');
    expect(useReportStore.getState().planCarryoverWarnings[created.id]).toContain('2026-06-01');
  });
});
