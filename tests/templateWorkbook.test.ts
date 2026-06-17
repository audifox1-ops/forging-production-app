import { describe, expect, it } from 'vitest';
import { getCellMap, createMonthlyTemplateSheet, updateTemplateWorkbookCell } from '../src/utils/templateWorkbook';

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

  it('defaults weekends to zero unless manually overridden', () => {
    const sheet = createMonthlyTemplateSheet(2026, 1);
    const [weekendSheet] = updateTemplateWorkbookCell([sheet], sheet.id, 10, 'B', 1000);
    const weekendRow = weekendSheet.rows.find(item => item.row_number === 10);

    expect(weekendRow).toBeDefined();
    expect(getCellMap(weekendRow!).C.value).toBe(0);
    expect(getCellMap(weekendRow!).Q.value).toBe(0);
    expect(getCellMap(weekendRow!).AE.value).toBe(0);
    expect(getCellMap(weekendRow!).AQ.value).toBe(0);

    const [overriddenSheet] = updateTemplateWorkbookCell([weekendSheet], sheet.id, 10, 'C', 123000);
    const overriddenRow = overriddenSheet.rows.find(item => item.row_number === 10);

    expect(overriddenRow).toBeDefined();
    expect(getCellMap(overriddenRow!).C.value).toBe(123000);
    expect(getCellMap(overriddenRow!).AQ.value).toBe(123000);
  });
});
