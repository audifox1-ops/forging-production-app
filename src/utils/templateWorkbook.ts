import type {
  ProductionEntry,
  ProductionReport,
  TemplateWorkbookCell,
  TemplateWorkbookColumnRange,
  TemplateWorkbookMergeRange,
  TemplateWorkbookRow,
  TemplateWorkbookSheet,
} from '../types';

export type TemplateEquipmentKey = 'P15' | 'P5' | 'R/M' | 'TOTAL';

export const TEMPLATE_QUALITY_COLUMNS = {
  cogging: 'AT',
  rework: 'AX',
  correction: 'AY',
} as const;

export interface TemplateEquipmentSummary {
  productActual: number | null;
  productPlan: number | null;
  achievementRate: number | null;
  billetActual: number | null;
  coggingActual: number | null;
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
  coggingActual?: string;
  grossTotal: string;
}>;

export const TEMPLATE_SUMMARY_COLUMNS: SummaryColumnMap = {
  P15: {
    productActual: 'B',
    productPlan: 'C',
    achievementRate: 'D',
    billetActual: 'E',
    coggingActual: 'F',
    grossTotal: 'G',
  },
  P5: {
    productActual: 'P',
    productPlan: 'Q',
    achievementRate: 'R',
    billetActual: 'S',
    coggingActual: 'T',
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
    coggingActual: 'AT',
    grossTotal: 'AU',
  },
};

const SYNC_EQUIPMENT_COLUMNS = {
  P15: TEMPLATE_SUMMARY_COLUMNS.P15,
  P5: TEMPLATE_SUMMARY_COLUMNS.P5,
  'R/M': TEMPLATE_SUMMARY_COLUMNS['R/M'],
} as const;

export const TEMPLATE_COMPACT_COLUMNS = Array.from(new Set([
  'A',
  ...Object.values(TEMPLATE_SUMMARY_COLUMNS).flatMap(group => [
    group.productActual,
    group.productPlan,
    group.achievementRate,
    group.billetActual,
    group.coggingActual,
    group.grossTotal,
  ].filter((column): column is string => Boolean(column))),
]));

export function columnToNumber(column: string) {
  return column.split('').reduce((value, char) => value * 26 + char.charCodeAt(0) - 64, 0);
}

function parseCellReference(cellReference: string) {
  const match = /^([A-Z]+)(\d+)$/.exec(cellReference);
  if (!match) return null;

  return {
    column: match[1],
    row: Number(match[2]),
  };
}

function parseMergeReference(mergeReference: string): TemplateWorkbookMergeRange | null {
  const [startReference, endReference] = mergeReference.split(':');
  const start = parseCellReference(startReference);
  const end = parseCellReference(endReference);
  if (!start || !end) return null;

  return {
    startColumn: start.column,
    startRow: start.row,
    endColumn: end.column,
    endRow: end.row,
  };
}

const MONTHLY_TEMPLATE_HIDDEN_COLUMNS: TemplateWorkbookColumnRange[] = [
  { min: 6, max: 6 },
  { min: 8, max: 15 },
  { min: 20, max: 20 },
  { min: 22, max: 29 },
  { min: 34, max: 41 },
  { min: 48, max: 49 },
  { min: 52, max: 57 },
];

const ANNUAL_TEMPLATE_HIDDEN_COLUMNS: TemplateWorkbookColumnRange[] = [
  { min: 3, max: 3 },
  { min: 6, max: 6 },
  { min: 8, max: 15 },
  { min: 17, max: 17 },
  { min: 20, max: 20 },
  { min: 22, max: 29 },
  { min: 31, max: 32 },
  { min: 34, max: 34 },
  { min: 37, max: 44 },
  { min: 46, max: 46 },
  { min: 49, max: 56 },
  { min: 58, max: 58 },
  { min: 63, max: 64 },
  { min: 67, max: 71 },
];

const MONTHLY_TEMPLATE_MERGE_REFS = [
  'A1:D4',
  'E1:Q2',
  'R1:AP2',
  'AQ1:AQ4',
  'AR1:AS1',
  'E3:Q3',
  'R3:AP3',
  'E4:Q4',
  'R4:AP4',
  'AT1:AW1',
  'AG6:AG7',
  'AX1:AY1',
  'AR2:AS4',
  'AT2:AW4',
  'AX2:AY4',
  'AP6:AR6',
  'AS6:AS7',
  'AT6:AT7',
  'AH5:AO5',
  'AP5:AY5',
  'J6:K6',
  'A5:A7',
  'B5:G5',
  'H5:O5',
  'P5:U5',
  'B6:D6',
  'E6:E7',
  'F6:F7',
  'G6:G7',
  'H6:I6',
  'L6:O6',
  'P6:R6',
  'S6:S7',
  'T6:T7',
  'AZ5:BC5',
  'BD5:BD7',
  'U6:U7',
  'V6:W6',
  'X6:Y6',
  'Z6:AC6',
  'AD6:AF6',
  'AU6:AU7',
  'AV6:AW6',
  'AX6:AY6',
  'AZ6:BC6',
  'AH6:AI6',
  'AJ6:AK6',
  'AL6:AO6',
  'V5:AC5',
  'AD5:AG5',
] as const;

const MONTHLY_TEMPLATE_MERGED_CELLS = MONTHLY_TEMPLATE_MERGE_REFS
  .map(parseMergeReference)
  .filter((range): range is TemplateWorkbookMergeRange => Boolean(range));

const TEMPLATE_HIDDEN_COLUMNS_BY_SHEET: Record<string, TemplateWorkbookColumnRange[]> = {
  '2601월': MONTHLY_TEMPLATE_HIDDEN_COLUMNS,
  '2604월': MONTHLY_TEMPLATE_HIDDEN_COLUMNS,
  '2024년 전체': ANNUAL_TEMPLATE_HIDDEN_COLUMNS,
  '2025년 전체': ANNUAL_TEMPLATE_HIDDEN_COLUMNS,
};

function getTemplateHiddenColumnRanges(sheet: TemplateWorkbookSheet | undefined) {
  if (!sheet) return [];
  if (sheet.hidden_columns?.length) return sheet.hidden_columns;
  if (sheet.kind === 'monthly') return MONTHLY_TEMPLATE_HIDDEN_COLUMNS;
  return TEMPLATE_HIDDEN_COLUMNS_BY_SHEET[sheet.sheet_name] ?? [];
}

export function getTemplateMergedCells(sheet: TemplateWorkbookSheet | undefined) {
  if (!sheet) return [];
  if (sheet.merged_cells?.length) return sheet.merged_cells;
  if (sheet.kind === 'monthly') return MONTHLY_TEMPLATE_MERGED_CELLS;
  return [];
}

function isColumnHidden(column: string, hiddenColumns: TemplateWorkbookColumnRange[]) {
  const columnNumber = columnToNumber(column);
  return hiddenColumns.some(range => columnNumber >= range.min && columnNumber <= range.max);
}

export function getVisibleSheetColumns(sheet: TemplateWorkbookSheet | undefined) {
  if (!sheet) return [];

  const hiddenColumns = getTemplateHiddenColumnRanges(sheet);
  return getSheetColumns(sheet).filter(column => !isColumnHidden(column, hiddenColumns));
}

export function getVisibleTemplateRows(sheet: TemplateWorkbookSheet | undefined) {
  if (!sheet) return [];

  const hiddenRows = new Set(sheet.hidden_rows ?? []);
  return sheet.rows.filter(row => !hiddenRows.has(row.row_number));
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
    coggingActual: getSummaryValue(cellMap, columns.coggingActual),
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

function getMonthlySheetMeta(sheet: TemplateWorkbookSheet) {
  const match = /^(\d{2})(\d{2})월$/.exec(sheet.sheet_name);
  if (!match) return null;

  const year = 2000 + Number(match[1]);
  const month = Number(match[2]);
  if (!Number.isFinite(year) || month < 1 || month > 12) return null;

  return {
    year,
    month,
    daysInMonth: new Date(Date.UTC(year, month, 0)).getUTCDate(),
  };
}

function formatMonthlyDateLabel(month: number, day: number) {
  return `${String(month).padStart(2, '0')}.${String(day).padStart(2, '0')}`;
}

function formatMonthlyIsoDate(year: number, month: number, day: number) {
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function excelSerialFromDate(dateString: string) {
  const [year, month, day] = dateString.split('-').map(Number);
  return Math.round((Date.UTC(year, month - 1, day) - Date.UTC(1899, 11, 30)) / 86400000);
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

function buildSummaryRow(
  row: TemplateWorkbookRow | undefined,
  label: string,
  options: {
    rowNumber: number;
    date?: string;
    isTotal?: boolean;
  }
): TemplateSummaryRow {
  const cellMap = row ? getCellMap(row) : {};
  const isTotal = options.isTotal ?? isTotalRow(label);

  return {
    rowNumber: options.rowNumber,
    label,
    date: options.date,
    isTotal,
    values: {
      P15: buildEquipmentSummary(cellMap, TEMPLATE_SUMMARY_COLUMNS.P15),
      P5: buildEquipmentSummary(cellMap, TEMPLATE_SUMMARY_COLUMNS.P5),
      'R/M': buildEquipmentSummary(cellMap, TEMPLATE_SUMMARY_COLUMNS['R/M']),
      TOTAL: buildEquipmentSummary(cellMap, TEMPLATE_SUMMARY_COLUMNS.TOTAL),
    },
  };
}

function sortCells(cells: TemplateWorkbookCell[]) {
  return [...cells].sort((a, b) => columnToNumber(a.column) - columnToNumber(b.column));
}

function setRowCell(
  row: TemplateWorkbookRow,
  column: string,
  value: TemplateWorkbookCell['value'],
  formula?: string
) {
  const existingCell = row.cells.find(cell => cell.column === column);

  if (existingCell) {
    existingCell.value = value;
    if (formula) {
      existingCell.formula = formula;
    } else {
      delete existingCell.formula;
    }
  } else {
    row.cells.push({
      column,
      value,
      ...(formula ? { formula } : {}),
    });
    row.cells = sortCells(row.cells);
  }
}

function getOrCreateMonthlyRow(sheet: TemplateWorkbookSheet, dateString: string) {
  const meta = getMonthlySheetMeta(sheet);
  if (!meta) return null;

  const [, , dayString] = dateString.split('-');
  const day = Number(dayString);
  if (!Number.isFinite(day) || day < 1 || day > meta.daysInMonth) return null;

  const rowNumber = day + 7;
  let row = sheet.rows.find(item => item.row_number === rowNumber);

  if (!row) {
    row = {
      row_number: rowNumber,
      row_date: dateString,
      cells: [],
    };
    sheet.rows.push(row);
    sheet.rows.sort((a, b) => a.row_number - b.row_number);
  }

  row.row_date = dateString;
  setRowCell(row, 'A', excelSerialFromDate(dateString));

  return row;
}

function getOrCreateMonthlyTotalRow(sheet: TemplateWorkbookSheet) {
  const meta = getMonthlySheetMeta(sheet);
  if (!meta) return null;

  const totalRowNumber = meta.daysInMonth + 8;
  let row = sheet.rows.find(item => isTotalRow(getFirstCellLabel(item)));

  if (!row) {
    row = sheet.rows.find(item => item.row_number === totalRowNumber);
  }

  if (!row) {
    row = {
      row_number: totalRowNumber,
      row_label: '합계',
      cells: [],
    };
    sheet.rows.push(row);
    sheet.rows.sort((a, b) => a.row_number - b.row_number);
  }

  row.row_label = '합계';
  delete row.row_date;
  setRowCell(row, 'A', '합계');

  return row;
}

function safeRate(actual: number, plan: number) {
  return plan > 0 ? actual / plan : 0;
}

function getNumericCell(row: TemplateWorkbookRow | undefined, column: string) {
  if (!row) return 0;
  return toNumber(row.cells.find(cell => cell.column === column)?.value) ?? 0;
}

function sumRows(rows: TemplateWorkbookRow[], column: string) {
  return rows.reduce((sum, row) => sum + getNumericCell(row, column), 0);
}

function getCellReference(row: TemplateWorkbookRow, column: string) {
  return `${column}${row.row_number}`;
}

function buildRowSumFormula(row: TemplateWorkbookRow, columns: string[]) {
  const references = columns.map(column => getCellReference(row, column));
  return references.length === 1 ? references[0] : `SUM(${references.join(',')})`;
}

function buildRateFormula(row: TemplateWorkbookRow, actualColumn: string, planColumn: string) {
  return `IFERROR(${getCellReference(row, actualColumn)}/${getCellReference(row, planColumn)},0)`;
}

function buildMonthlySumFormula(column: string, startRow: number, endRow: number) {
  return `SUM(${column}${startRow}:${column}${endRow})`;
}

function recalculateTemplateRow(row: TemplateWorkbookRow) {
  (Object.values(SYNC_EQUIPMENT_COLUMNS)).forEach(columns => {
    const productActual = getNumericCell(row, columns.productActual);
    const productPlan = getNumericCell(row, columns.productPlan);
    const billetActual = getNumericCell(row, columns.billetActual ?? '');
    const coggingActual = getNumericCell(row, columns.coggingActual ?? '');
    const grossColumns = [
      columns.productActual,
      columns.billetActual,
      columns.coggingActual,
    ].filter((column): column is string => Boolean(column));

    setRowCell(
      row,
      columns.achievementRate,
      safeRate(productActual, productPlan),
      buildRateFormula(row, columns.productActual, columns.productPlan)
    );
    setRowCell(
      row,
      columns.grossTotal,
      productActual + billetActual + coggingActual,
      buildRowSumFormula(row, grossColumns)
    );
  });

  const totalProductActual = getNumericCell(row, 'B') + getNumericCell(row, 'P') + getNumericCell(row, 'AD');
  const totalProductPlan = getNumericCell(row, 'C') + getNumericCell(row, 'Q') + getNumericCell(row, 'AE');
  const totalBilletActual = getNumericCell(row, 'E') + getNumericCell(row, 'S');
  const totalCoggingColumn = TEMPLATE_SUMMARY_COLUMNS.TOTAL.coggingActual!;
  const equipmentCoggingFormula = buildRowSumFormula(row, ['F', 'T']);
  const totalCoggingCell = row.cells.find(cell => cell.column === totalCoggingColumn);
  const shouldDeriveTotalCogging = !totalCoggingCell || totalCoggingCell.formula === equipmentCoggingFormula;
  const totalCoggingActual = shouldDeriveTotalCogging
    ? getNumericCell(row, 'F') + getNumericCell(row, 'T')
    : getNumericCell(row, totalCoggingColumn);

  setRowCell(
    row,
    TEMPLATE_SUMMARY_COLUMNS.TOTAL.productActual,
    totalProductActual,
    buildRowSumFormula(row, ['B', 'P', 'AD'])
  );
  setRowCell(
    row,
    TEMPLATE_SUMMARY_COLUMNS.TOTAL.productPlan,
    totalProductPlan,
    buildRowSumFormula(row, ['C', 'Q', 'AE'])
  );
  setRowCell(
    row,
    TEMPLATE_SUMMARY_COLUMNS.TOTAL.achievementRate,
    safeRate(totalProductActual, totalProductPlan),
    buildRateFormula(row, TEMPLATE_SUMMARY_COLUMNS.TOTAL.productActual, TEMPLATE_SUMMARY_COLUMNS.TOTAL.productPlan)
  );
  setRowCell(
    row,
    TEMPLATE_SUMMARY_COLUMNS.TOTAL.billetActual!,
    totalBilletActual,
    buildRowSumFormula(row, ['E', 'S'])
  );
  setRowCell(
    row,
    totalCoggingColumn,
    totalCoggingActual,
    shouldDeriveTotalCogging ? equipmentCoggingFormula : totalCoggingCell.formula
  );
  setRowCell(
    row,
    TEMPLATE_SUMMARY_COLUMNS.TOTAL.grossTotal,
    totalProductActual + totalBilletActual + totalCoggingActual,
    buildRowSumFormula(row, [
      TEMPLATE_SUMMARY_COLUMNS.TOTAL.productActual,
      TEMPLATE_SUMMARY_COLUMNS.TOTAL.billetActual!,
      TEMPLATE_SUMMARY_COLUMNS.TOTAL.coggingActual!,
    ])
  );
}

function recalculateMonthlyTotal(sheet: TemplateWorkbookSheet) {
  const meta = getMonthlySheetMeta(sheet);
  const totalRow = getOrCreateMonthlyTotalRow(sheet);
  if (!meta || !totalRow) return;

  const dailyRows = Array.from({ length: meta.daysInMonth }, (_, index) =>
    sheet.rows.find(row => row.row_number === index + 8)
  ).filter((row): row is TemplateWorkbookRow => Boolean(row));

  const totalColumns = Array.from(new Set(
    [
      ...Object.values(TEMPLATE_SUMMARY_COLUMNS).flatMap(columns => [
        columns.productActual,
        columns.productPlan,
        columns.billetActual,
        columns.coggingActual,
        columns.grossTotal,
      ].filter((column): column is string => Boolean(column))),
      ...Object.values(TEMPLATE_QUALITY_COLUMNS),
    ]
  ));

  const firstDailyRowNumber = 8;
  const lastDailyRowNumber = meta.daysInMonth + 7;
  totalColumns.forEach(column =>
    setRowCell(
      totalRow,
      column,
      sumRows(dailyRows, column),
      buildMonthlySumFormula(column, firstDailyRowNumber, lastDailyRowNumber)
    )
  );
  recalculateTemplateRow(totalRow);
}

function cloneTemplateSheets(sheets: TemplateWorkbookSheet[]) {
  return sheets.map(sheet => ({
    ...sheet,
    rows: sheet.rows.map(row => ({
      ...row,
      cells: row.cells.map(cell => ({ ...cell })),
    })),
  }));
}

function getMonthlySheetForDate(sheets: TemplateWorkbookSheet[], dateString: string) {
  const [year, month] = dateString.split('-');
  const sheetName = `${year.slice(2)}${month}월`;
  return sheets.find(sheet => sheet.sheet_name === sheetName);
}

function aggregateReportEntries(entries: ProductionEntry[], reportId: string) {
  const targetEntries = entries.filter(entry => entry.report_id === reportId);

  return (Object.keys(SYNC_EQUIPMENT_COLUMNS) as Array<keyof typeof SYNC_EQUIPMENT_COLUMNS>).reduce((acc, equipment) => {
    const equipmentEntries = targetEntries.filter(entry => entry.equipment === equipment);
    acc[equipment] = {
      productPlan: equipmentEntries.reduce((sum, entry) => sum + (entry.product_plan || 0), 0),
      productActual: equipmentEntries.reduce((sum, entry) => sum + (entry.product_actual || 0), 0),
      billetPlan: equipment === 'R/M' ? 0 : equipmentEntries.reduce((sum, entry) => sum + (entry.billet_plan || 0), 0),
      billetActual: equipment === 'R/M' ? 0 : equipmentEntries.reduce((sum, entry) => sum + (entry.billet_actual || 0), 0),
      nextProductPlan: equipmentEntries.reduce((sum, entry) => sum + (entry.next_product_plan || 0), 0),
      nextBilletPlan: equipment === 'R/M' ? 0 : equipmentEntries.reduce((sum, entry) => sum + (entry.next_billet_plan || 0), 0),
    };
    return acc;
  }, {} as Record<keyof typeof SYNC_EQUIPMENT_COLUMNS, {
    productPlan: number;
    productActual: number;
    billetPlan: number;
    billetActual: number;
    nextProductPlan: number;
    nextBilletPlan: number;
  }>);
}

function applyActualEntryValues(row: TemplateWorkbookRow, totals: ReturnType<typeof aggregateReportEntries>) {
  (Object.keys(SYNC_EQUIPMENT_COLUMNS) as Array<keyof typeof SYNC_EQUIPMENT_COLUMNS>).forEach(equipment => {
    const columns = SYNC_EQUIPMENT_COLUMNS[equipment];
    const values = totals[equipment];

    setRowCell(row, columns.productActual, values.productActual);
    setRowCell(row, columns.productPlan, values.productPlan);
    if (columns.billetActual) setRowCell(row, columns.billetActual, values.billetActual);
  });
  recalculateTemplateRow(row);
}

function applyPlanEntryValues(row: TemplateWorkbookRow, totals: ReturnType<typeof aggregateReportEntries>) {
  (Object.keys(SYNC_EQUIPMENT_COLUMNS) as Array<keyof typeof SYNC_EQUIPMENT_COLUMNS>).forEach(equipment => {
    const columns = SYNC_EQUIPMENT_COLUMNS[equipment];
    const values = totals[equipment];

    setRowCell(row, columns.productPlan, values.nextProductPlan);
    if (columns.billetActual) {
      const existingBilletActual = getNumericCell(row, columns.billetActual);
      setRowCell(row, columns.billetActual, existingBilletActual);
    }
  });
  recalculateTemplateRow(row);
}

function extractMonthlySummaryRows(sheet: TemplateWorkbookSheet) {
  const meta = getMonthlySheetMeta(sheet);
  if (!meta) return null;

  const rowsByNumber = new Map(sheet.rows.map(row => [row.row_number, row]));
  const dailyRows = Array.from({ length: meta.daysInMonth }, (_, index) => {
    const day = index + 1;
    const rowNumber = day + 7;
    return buildSummaryRow(
      rowsByNumber.get(rowNumber),
      formatMonthlyDateLabel(meta.month, day),
      {
        rowNumber,
        date: formatMonthlyIsoDate(meta.year, meta.month, day),
        isTotal: false,
      }
    );
  });
  const totalRowNumber = meta.daysInMonth + 8;
  const explicitTotalRow = sheet.rows.find(row => isTotalRow(getFirstCellLabel(row)));
  const totalRow = buildSummaryRow(
    explicitTotalRow ?? rowsByNumber.get(totalRowNumber),
    '합계',
    {
      rowNumber: explicitTotalRow?.row_number ?? totalRowNumber,
      isTotal: true,
    }
  );

  return [...dailyRows, totalRow];
}

export function extractTemplateSummaryRows(sheet: TemplateWorkbookSheet | undefined) {
  if (!sheet) return [];

  if (sheet.kind === 'monthly') {
    const monthlyRows = extractMonthlySummaryRows(sheet);
    if (monthlyRows) return monthlyRows;
  }

  return sheet.rows
    .map((row): TemplateSummaryRow => {
      const label = getSummaryRowLabel(row, sheet);
      return buildSummaryRow(row, label, {
        rowNumber: row.row_number,
        date: row.row_date,
      });
    })
    .filter(row => shouldIncludeSummaryRow(row, sheet));
}

export function syncTemplateSheetsWithReportEntries(
  sheets: TemplateWorkbookSheet[],
  reports: ProductionReport[],
  entries: ProductionEntry[],
  reportId: string
) {
  const report = reports.find(item => item.id === reportId);
  if (!report || sheets.length === 0) return sheets;

  const nextSheets = cloneTemplateSheets(sheets);
  const totals = aggregateReportEntries(entries, reportId);
  const actualSheet = getMonthlySheetForDate(nextSheets, report.report_date);
  const actualRow = actualSheet ? getOrCreateMonthlyRow(actualSheet, report.report_date) : null;

  if (actualSheet && actualRow) {
    applyActualEntryValues(actualRow, totals);
    recalculateMonthlyTotal(actualSheet);
    actualSheet.imported_at = new Date().toISOString();
  }

  const planSheet = getMonthlySheetForDate(nextSheets, report.next_plan_date);
  const planRow = planSheet ? getOrCreateMonthlyRow(planSheet, report.next_plan_date) : null;

  if (planSheet && planRow) {
    applyPlanEntryValues(planRow, totals);
    recalculateMonthlyTotal(planSheet);
    planSheet.imported_at = new Date().toISOString();
  }

  return nextSheets;
}

function compareTemplateSheetContent(sheets: TemplateWorkbookSheet[]) {
  return JSON.stringify(
    sheets.map(({ imported_at: _importedAt, ...sheet }) => sheet)
  );
}

export function syncTemplateSheetsWithAllReportEntries(
  sheets: TemplateWorkbookSheet[],
  reports: ProductionReport[],
  entries: ProductionEntry[]
) {
  if (sheets.length === 0 || reports.length === 0) return sheets;
  const sortedReports = [...reports].sort((a, b) => a.report_date.localeCompare(b.report_date));

  return sortedReports.reduce((currentSheets, report) => {
    const previousContent = compareTemplateSheetContent(currentSheets);
    const syncedSheets = syncTemplateSheetsWithReportEntries(
      currentSheets,
      reports,
      entries,
      report.id
    );

    return compareTemplateSheetContent(syncedSheets) === previousContent
      ? currentSheets
      : syncedSheets;
  }, sheets);
}

export function updateTemplateWorkbookCell(
  sheets: TemplateWorkbookSheet[],
  sheetId: string,
  rowNumber: number,
  column: string,
  value: TemplateWorkbookCell['value']
) {
  const nextSheets = cloneTemplateSheets(sheets);
  const sheet = nextSheets.find(item => item.id === sheetId);
  if (!sheet) return sheets;

  let row = sheet.rows.find(item => item.row_number === rowNumber);
  if (!row) {
    row = { row_number: rowNumber, cells: [] };
    sheet.rows.push(row);
    sheet.rows.sort((a, b) => a.row_number - b.row_number);
  }

  setRowCell(row, column.toUpperCase(), value);
  recalculateTemplateRow(row);
  if (sheet.kind === 'monthly') recalculateMonthlyTotal(sheet);
  sheet.imported_at = new Date().toISOString();

  return nextSheets;
}

export function deleteTemplateWorkbookRow(
  sheets: TemplateWorkbookSheet[],
  sheetId: string,
  rowNumber: number
) {
  const nextSheets = cloneTemplateSheets(sheets);
  const sheet = nextSheets.find(item => item.id === sheetId);
  if (!sheet) return sheets;

  sheet.rows = sheet.rows.filter(row => row.row_number !== rowNumber);
  if (sheet.kind === 'monthly') recalculateMonthlyTotal(sheet);
  sheet.imported_at = new Date().toISOString();

  return nextSheets;
}

export function addTemplateWorkbookRow(
  sheets: TemplateWorkbookSheet[],
  sheetId: string
) {
  const nextSheets = cloneTemplateSheets(sheets);
  const sheet = nextSheets.find(item => item.id === sheetId);
  if (!sheet) return sheets;

  const nextRowNumber = Math.max(0, ...sheet.rows.map(row => row.row_number)) + 1;
  sheet.rows.push({
    row_number: nextRowNumber,
    cells: [{ column: 'A', value: '' }],
  });
  sheet.rows.sort((a, b) => a.row_number - b.row_number);
  sheet.imported_at = new Date().toISOString();

  return nextSheets;
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
  const coggingActual = sumNullable(rows.map(row => row.values[equipment].coggingActual));
  const grossTotal = sumNullable(rows.map(row => row.values[equipment].grossTotal));

  return {
    productActual,
    productPlan,
    achievementRate: calculateRate(productActual, productPlan),
    billetActual,
    coggingActual,
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
