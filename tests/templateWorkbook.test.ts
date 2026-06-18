import { describe, expect, it } from 'vitest';
import { createMonthlyTemplateSheet, getCellMap, syncTemplateSheetsWithReportEntries, updateTemplateWorkbookCell } from '../src/utils/templateWorkbook';
import type { ProductionEntry, ProductionReport } from '../src/types';

describe('template workbook plan defaults', () => {
  it('applies fixed weekday plan totals to monthly rows', () => {
    const sheet = createMonthlyTemplateSheet(2026, 1);
    const [updatedSheet] = updateTemplateWorkbookCell([sheet], sheet.id, 9, 'B', 100000);
    const row = updatedSheet.rows.find(item => item.row_number === 9);

    expect(row).toBeDefined();
    expect(getCellMap(row!).C.value).toBe(145000);
    expect(getCellMap(row!).Q.value).toBe(70000);
    expect(getCellMap(row!).AE.value).toBe(200000);
    expect(getCellMap(row!).AQ.value).toBe(415000);
  });

  it('forces weekends to zero', () => {
    const sheet = createMonthlyTemplateSheet(2026, 1);
    const [weekendSheet] = updateTemplateWorkbookCell([sheet], sheet.id, 10, 'B', 1000);
    const weekendRow = weekendSheet.rows.find(item => item.row_number === 10);

    expect(weekendRow).toBeDefined();
    expect(getCellMap(weekendRow!).C.value).toBe(0);
    expect(getCellMap(weekendRow!).Q.value).toBe(0);
    expect(getCellMap(weekendRow!).AE.value).toBe(0);
    expect(getCellMap(weekendRow!).AQ.value).toBe(0);
  });

  it('forces public holidays to zero', () => {
    const sheet = createMonthlyTemplateSheet(2026, 3);
    const [holidaySheet] = updateTemplateWorkbookCell([sheet], sheet.id, 9, 'C', 123000);
    const holidayRow = holidaySheet.rows.find(item => item.row_number === 9);

    expect(holidayRow).toBeDefined();
    expect(getCellMap(holidayRow!).C.value).toBe(0);
    expect(getCellMap(holidayRow!).Q.value).toBe(0);
    expect(getCellMap(holidayRow!).AE.value).toBe(0);
    expect(getCellMap(holidayRow!).AQ.value).toBe(0);
  });

  it('forces the June 3 temporary holiday to zero', () => {
    const sheet = createMonthlyTemplateSheet(2026, 6);
    const [holidaySheet] = updateTemplateWorkbookCell([sheet], sheet.id, 10, 'AE', 200000);
    const holidayRow = holidaySheet.rows.find(item => item.row_number === 10);

    expect(holidayRow).toBeDefined();
    expect(getCellMap(holidayRow!).C.value).toBe(0);
    expect(getCellMap(holidayRow!).Q.value).toBe(0);
    expect(getCellMap(holidayRow!).AE.value).toBe(0);
    expect(getCellMap(holidayRow!).AQ.value).toBe(0);
  });

  it('aggregates R/M actuals with P8 production for the workbook preview', () => {
    const report: ProductionReport = {
      id: 'report-1',
      report_date: '2026-06-02',
      next_plan_date: '2026-06-04',
      status: 'draft',
      created_by: 'tester',
      created_at: '2026-06-02T00:00:00Z',
      updated_at: '2026-06-02T00:00:00Z',
    };

    const entries: ProductionEntry[] = [
      {
        id: 'entry-rm',
        report_id: report.id,
        user_id: 'u1',
        equipment: 'R/M',
        shift: '주간',
        product_plan: 0,
        product_actual: 120000,
        billet_plan: 0,
        billet_actual: 0,
        next_product_plan: 0,
        next_billet_plan: 0,
        submit_status: 'draft',
      },
      {
        id: 'entry-p8',
        report_id: report.id,
        user_id: 'u2',
        equipment: 'P8',
        shift: '주간',
        product_plan: 0,
        product_actual: 80000,
        billet_plan: 0,
        billet_actual: 0,
        next_product_plan: 0,
        next_billet_plan: 0,
        submit_status: 'draft',
      },
    ];

    const [sheet] = syncTemplateSheetsWithReportEntries(
      [createMonthlyTemplateSheet(2026, 6)],
      [report],
      entries,
      report.id
    );
    const actualRow = sheet.rows.find(item => item.row_date === report.report_date);

    expect(actualRow).toBeDefined();
    expect(getCellMap(actualRow!).AD.value).toBe(200000);
  });
});
