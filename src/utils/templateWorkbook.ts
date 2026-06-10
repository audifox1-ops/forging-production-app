import type { TemplateWorkbookCell, TemplateWorkbookRow, TemplateWorkbookSheet } from '../types';

export type TemplateEquipmentKey = 'P15' | 'P5' | 'R/M' | 'TOTAL';

export interface TemplateEquipmentSummary {
  productActual: number | null;
  productPlan: number | null;
  achievementRate: number | null;
  billetActual: number | null;
  grossTotal: number | null;
}

export interface TemplateSummaryRow {
  rowNumber: number;
  label: string;
  date?: string;
  isTotal: boolean;
  values: Record<TemplateEquipmentKey, TemplateEquipmentSummary>;
}

export interface TemplateWorkbookAppSummary {
  monthlyRows: Array<{
    sheetId: string;
    sheetName: string;
    summary: TemplateSummaryRow;
  }>;
  total: TemplateEquipmentSummary;
}

type SummaryColumnMap = Record<TemplateEquipmentKey, {
  productActual: string;
  productPlan: string;
  achievementRate: string;
  billetActual?: string;
  grossTotal: string;
}>;

export const TEMPLATE_SUMMARY_COLUMNS: SummaryColumnMap = {
  P15: {
    productActual: 'B',
    productPlan: 'C',
    achievementRate: 'D',
    billetActual: 'E',
    grossTotal: 'G',
  },
  P5: {
    productActual: 'P',
    productPlan: 'Q',
    achievementRate: 'R',
    billetActual: 'S',
    grossTotal: 'U',
  },
  'R/M': {
    productActual: 'AD',
    productPlan: 'AE',
    achievementRate: 'AF',
    grossTotal: 'AG',
  },
  TOTAL: {
    productActual: 'AP',
    productPlan: 'AQ',
    achievementRate: 'AR',
    billetActual: 'AS',
    grossTotal: 'AU',
  },
};

export const TEMPLATE_COMPACT_COLUMNS = Array.from(new Set([
  'A',
  ...Object.values(TEMPLATE_SUMMARY_COLUMNS).flatMap(group => [
    group.productActual,
    group.productPlan,
    group.achievementRate,
    group.billetActual,
    group.grossTotal,
  ].filter((column): column is string => Boolean(column))),
]));

export function columnToNumber(column: string) {
  return column.split('').reduce((value, char) => value * 26 + char.charCodeAt(0) - 64, 0);
}

export function getCellMap(row: TemplateWorkbookRow) {
  return row.cells.reduce<Record<string, TemplateWorkbookCell>>((acc, cell) => {
    acc[cell.column] = cell;
    return acc;
  }, {});
}

export function getSheetColumns(sheet: TemplateWorkbookSheet | undefined) {
  if (!sheet) return [];

  const columns = new Set<string>();
  sheet.rows.forEach(row => {
    row.cells.forEach(cell => columns.add(cell.column));
  });

  return Array.from(columns).sort((a, b) => columnToNumber(a) - columnToNumber(b));
}

export function getCompactSheetColumns(sheet: TemplateWorkbookSheet | undefined) {
  if (!sheet) return [];

  const available = new Set(getSheetColumns(sheet));
  return TEMPLATE_COMPACT_COLUMNS.filter(column => available.has(column));
}

function toNumber(value: TemplateWorkbookCell['value'] | undefined) {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function getSummaryValue(
  cellMap: Record<string, TemplateWorkbookCell>,
  column: string | undefined
) {
  return column ? toNumber(cellMap[column]?.value) : null;
}

function buildEquipmentSummary(
  cellMap: Record<string, TemplateWorkbookCell>,
  columns: SummaryColumnMap[TemplateEquipmentKey]
): TemplateEquipmentSummary {
  return {
    productActual: getSummaryValue(cellMap, columns.productActual),
    productPlan: getSummaryValue(cellMap, columns.productPlan),
    achievementRate: getSummaryValue(cellMap, columns.achievementRate),
    billetActual: getSummaryValue(cellMap, columns.billetActual),
    grossTotal: getSummaryValue(cellMap, columns.grossTotal),
  };
}

function cleanLabel(value: string) {
  return value.replace(/\s+/g, ' ').trim();
}

function getFirstCellLabel(row: TemplateWorkbookRow) {
  const firstCell = row.cells.find(cell => cell.column === 'A');
  return typeof firstCell?.value === 'string' ? cleanLabel(firstCell.value) : '';
}

function getSummaryRowLabel(row: TemplateWorkbookRow, sheet: TemplateWorkbookSheet) {
  if (row.row_label) return cleanLabel(row.row_label);
  if (sheet.kind === 'monthly' && row.row_date) return row.row_date.slice(5).replace('-', '.');
  return getFirstCellLabel(row);
}

function isTotalRow(label: string) {
  return /합계|total/i.test(label);
}

function hasAnyNumber(summary: TemplateSummaryRow) {
  return Object.values(summary.values).some(value =>
    Object.values(value).some(item => typeof item === 'number' && item !== 0)
  );
}

function shouldIncludeSummaryRow(row: TemplateSummaryRow, sheet: TemplateWorkbookSheet) {
  if (row.isTotal) return true;
  if (sheet.kind === 'monthly' && !row.date) return false;
  if (sheet.kind === 'annual' && !/(월|합계)/.test(row.label)) return false;
  return hasAnyNumber(row);
}

export function extractTemplateSummaryRows(sheet: TemplateWorkbookSheet | undefined) {
  if (!sheet) return [];

  return sheet.rows
    .map((row): TemplateSummaryRow => {
      const cellMap = getCellMap(row);
      const label = getSummaryRowLabel(row, sheet);

      return {
        rowNumber: row.row_number,
        label,
        date: row.row_date,
        isTotal: isTotalRow(label),
        values: {
          P15: buildEquipmentSummary(cellMap, TEMPLATE_SUMMARY_COLUMNS.P15),
          P5: buildEquipmentSummary(cellMap, TEMPLATE_SUMMARY_COLUMNS.P5),
          'R/M': buildEquipmentSummary(cellMap, TEMPLATE_SUMMARY_COLUMNS['R/M']),
          TOTAL: buildEquipmentSummary(cellMap, TEMPLATE_SUMMARY_COLUMNS.TOTAL),
        },
      };
    })
    .filter(row => shouldIncludeSummaryRow(row, sheet));
}

export function getTemplateSheetTotal(sheet: TemplateWorkbookSheet | undefined) {
  const rows = extractTemplateSummaryRows(sheet);
  return rows.find(row => row.isTotal) ?? rows[rows.length - 1] ?? null;
}

function sumNullable(values: Array<number | null>) {
  const validValues = values.filter((value): value is number => typeof value === 'number');
  if (validValues.length === 0) return null;
  return validValues.reduce((sum, value) => sum + value, 0);
}

function calculateRate(actual: number | null, plan: number | null) {
  if (!actual || !plan) return null;
  return actual / plan;
}

function sumEquipmentSummary(rows: TemplateSummaryRow[], equipment: TemplateEquipmentKey): TemplateEquipmentSummary {
  const productActual = sumNullable(rows.map(row => row.values[equipment].productActual));
  const productPlan = sumNullable(rows.map(row => row.values[equipment].productPlan));
  const billetActual = sumNullable(rows.map(row => row.values[equipment].billetActual));
  const grossTotal = sumNullable(rows.map(row => row.values[equipment].grossTotal));

  return {
    productActual,
    productPlan,
    achievementRate: calculateRate(productActual, productPlan),
    billetActual,
    grossTotal,
  };
}

export function buildTemplateWorkbookAppSummary(sheets: TemplateWorkbookSheet[]): TemplateWorkbookAppSummary {
  const monthlyRows = sheets
    .filter(sheet => sheet.kind === 'monthly')
    .map(sheet => {
      const summary = getTemplateSheetTotal(sheet);
      return summary
        ? {
            sheetId: sheet.id,
            sheetName: sheet.sheet_name,
            summary,
          }
        : null;
    })
    .filter((row): row is NonNullable<typeof row> => Boolean(row));

  return {
    monthlyRows,
    total: sumEquipmentSummary(monthlyRows.map(row => row.summary), 'TOTAL'),
  };
}
