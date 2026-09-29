import { describe, expect, it } from 'vitest';
import { DEMO_PERIOD_TARGETS, DEMO_TARGETS, DEMO_USERS } from '../src/lib/mockData';
import { useReportStore } from '../src/store/reportStore';
import { createMonthlyTemplateSheet, getCellMap } from '../src/utils/templateWorkbook';

describe('reportStore report creation', () => {
  it('syncs the new report into the production aggregation sheets', () => {
    useReportStore.setState({
      reports: [],
      entries: [],
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
    });

    useReportStore.getState().createReport('2026-06-02');

    const rows = useReportStore.getState().templateSheets[0].rows;
    const actualRow = rows.find(row => row.row_date === '2026-06-02');
    const planRow = rows.find(row => row.row_date === '2026-06-04');
    expect(actualRow).toBeDefined();
    expect(planRow).toBeDefined();
    expect(getCellMap(actualRow!).B.value).toBe(0);
    expect(getCellMap(planRow!).C.value).toBeGreaterThan(0);
  });
});
