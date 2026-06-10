import React from 'react';
import { BarChart3, Download, Eye, Grid2X2, Plus, Printer, RefreshCw, Table2, Trash2, X } from 'lucide-react';
import { useReportStore } from '../store/reportStore';
import { downloadTemplateWorkbook } from '../utils/excelTemplate';
import {
  buildTemplateWorkbookAppSummary,
  columnToNumber,
  extractTemplateSummaryRows,
  getCellMap,
  getCompactSheetColumns,
  getSheetColumns,
  getTemplateMergedCells,
  getVisibleSheetColumns,
  getVisibleTemplateRows,
  TemplateEquipmentKey,
  TemplateSummaryRow,
} from '../utils/templateWorkbook';
import type { TemplateWorkbookCell, TemplateWorkbookRow, TemplateWorkbookSheet } from '../types';

type ViewMode = 'summary' | 'compact' | 'raw';

const PRINT_DOCUMENT_CLASS = 'template-workbook-print-document';
const PRINT_PAGE_STYLE_ID = 'template-workbook-landscape-print-style';
const PREVIEW_PRINTING_CLASS = 'template-workbook-preview-printing';
const PERCENT_COLUMNS = new Set(['D', 'R', 'AF', 'AR']);
const EQUIPMENT_COLUMNS: Array<{ key: TemplateEquipmentKey; label: string; colorClass: string }> = [
  { key: 'P15', label: 'P15', colorClass: 'text-blue-700' },
  { key: 'P5', label: 'P5', colorClass: 'text-emerald-700' },
  { key: 'R/M', label: 'R/M', colorClass: 'text-violet-700' },
  { key: 'TOTAL', label: '전체', colorClass: 'text-slate-900' },
];

function formatNumber(value: number | null | undefined) {
  if (typeof value !== 'number' || !Number.isFinite(value)) return '-';
  return value.toLocaleString('ko-KR', {
    maximumFractionDigits: Number.isInteger(value) ? 0 : 1,
  });
}

function formatRate(value: number | null | undefined) {
  if (typeof value !== 'number' || !Number.isFinite(value)) return '-';
  return `${(value * 100).toLocaleString('ko-KR', { maximumFractionDigits: 1 })}%`;
}

function formatCellValue(cell: TemplateWorkbookCell | undefined, column: string, row: TemplateWorkbookRow) {
  if (!cell) return '';

  if (column === 'A' && row.row_date) {
    return row.row_date;
  }

  if (cell.value === null || cell.value === undefined || cell.value === '') {
    return cell.formula ? `=${cell.formula}` : '';
  }

  if (typeof cell.value === 'number') {
    if (PERCENT_COLUMNS.has(column) && Math.abs(cell.value) <= 10) {
      return formatRate(cell.value);
    }

    return formatNumber(cell.value);
  }

  return cell.value.replace(/\s+/g, ' ').trim();
}

function getCellAddress(rowNumber: number, column: string) {
  return `${column}${rowNumber}`;
}

function getCellTitle(cell: TemplateWorkbookCell | undefined, address?: string) {
  const details = [
    address ? `셀 ${address}` : null,
    cell?.formula ? `수식 =${cell.formula}` : null,
  ].filter(Boolean);

  return details.length > 0 ? details.join('\n') : undefined;
}

function parseWorkbookInputValue(value: string, cell: TemplateWorkbookCell | undefined, column: string) {
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (column !== 'A' && (typeof cell?.value === 'number' || /^-?\d+(\.\d+)?$/.test(trimmed))) {
    return Number(trimmed);
  }
  return trimmed;
}

function formatImportedAt(value: string | undefined) {
  if (!value) return '-';
  return new Date(value).toLocaleString('ko-KR', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function ensureLandscapePrintStyle() {
  if (typeof document === 'undefined') return null;

  let printStyle = document.getElementById(PRINT_PAGE_STYLE_ID) as HTMLStyleElement | null;
  if (!printStyle) {
    printStyle = document.createElement('style');
    printStyle.id = PRINT_PAGE_STYLE_ID;
    printStyle.media = 'print';
    printStyle.textContent = '@page { size: A4 landscape; margin: 5mm; }';
    document.head.appendChild(printStyle);
  }

  return printStyle;
}

function setPreviewPrintMode(enabled: boolean) {
  if (typeof document === 'undefined') return;

  document.documentElement.classList.toggle(PREVIEW_PRINTING_CLASS, enabled);
  document.body.classList.toggle(PREVIEW_PRINTING_CLASS, enabled);
}

function printTemplateWorkbook(options: { preview?: boolean } = {}) {
  ensureLandscapePrintStyle();

  const isPreviewPrint = Boolean(options.preview);
  if (isPreviewPrint) {
    setPreviewPrintMode(true);
  }

  const cleanupPreviewPrint = () => {
    if (isPreviewPrint) setPreviewPrintMode(false);
  };

  if (isPreviewPrint) {
    window.addEventListener('afterprint', cleanupPreviewPrint, { once: true });
  }

  window.setTimeout(() => {
    window.print();
    if (isPreviewPrint) {
      window.setTimeout(cleanupPreviewPrint, 3000);
    }
  }, 0);
}

function formatPeriodLabel(row: TemplateSummaryRow) {
  if (row.date) return row.date.slice(5).replace('-', '.');
  return row.label;
}

function hasWarningValue(row: TemplateSummaryRow) {
  return Object.values(row.values).some(value =>
    Object.values(value).some(item => typeof item !== 'number' && item !== null)
  );
}

function SummaryMetricCard({
  label,
  value,
  accentClass,
}: {
  label: string;
  value: string;
  accentClass: string;
}) {
  return (
    <div className="bg-white border border-gray-200 rounded-lg px-4 py-3">
      <div className="text-xs text-gray-500">{label}</div>
      <div className={`text-xl font-bold mt-1 tabular-nums ${accentClass}`}>{value}</div>
    </div>
  );
}

function SummaryTable({ rows }: { rows: TemplateSummaryRow[] }) {
  if (rows.length === 0) {
    return (
      <div className="px-4 py-10 text-center text-sm text-gray-400">
        표시할 핵심 집계 행이 없습니다.
      </div>
    );
  }

  return (
    <div className="template-print-sheet overflow-auto max-h-[calc(100vh-360px)] print-sheet">
      <table className="template-summary-print-table min-w-[1200px] w-full border-collapse text-xs">
        <thead>
          <tr>
            <th rowSpan={2} className="sticky top-0 left-0 z-30 bg-slate-900 text-white border border-slate-700 px-3 py-2 text-left min-w-[86px]">
              구분
            </th>
            {EQUIPMENT_COLUMNS.map(group => (
              <th
                key={group.key}
                colSpan={group.key === 'TOTAL' ? 6 : 3}
                className="sticky top-0 z-20 bg-blue-800 text-white border border-blue-700 px-3 py-2 text-center"
              >
                {group.label}
              </th>
            ))}
          </tr>
          <tr>
            {EQUIPMENT_COLUMNS.map(group => (
              <React.Fragment key={group.key}>
                <th className="sticky top-[33px] z-20 bg-blue-700 text-white border border-blue-600 px-2 py-2 text-right">제품</th>
                <th className="sticky top-[33px] z-20 bg-blue-700 text-white border border-blue-600 px-2 py-2 text-right">계획</th>
                    <th className="sticky top-[33px] z-20 bg-blue-700 text-white border border-blue-600 px-2 py-2 text-right">달성</th>
                {group.key === 'TOTAL' && (
                  <>
                    <th className="sticky top-[33px] z-20 bg-blue-700 text-white border border-blue-600 px-2 py-2 text-right">황지</th>
                    <th className="sticky top-[33px] z-20 bg-blue-700 text-white border border-blue-600 px-2 py-2 text-right">코깅</th>
                    <th className="sticky top-[33px] z-20 bg-blue-700 text-white border border-blue-600 px-2 py-2 text-right">총합</th>
                  </>
                )}
              </React.Fragment>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map(row => (
            <tr
              key={row.rowNumber}
              className={`hover:bg-blue-50 ${row.isTotal ? 'bg-blue-50 font-bold' : 'odd:bg-white even:bg-slate-50'}`}
            >
              <td className={`sticky left-0 z-10 border border-gray-200 px-3 py-2 text-left ${row.isTotal ? 'bg-blue-100 text-blue-900' : 'bg-white text-gray-700'}`}>
                {formatPeriodLabel(row)}
              </td>
              {EQUIPMENT_COLUMNS.map(group => {
                const value = row.values[group.key];
                return (
                  <React.Fragment key={group.key}>
                    <td className={`border border-gray-200 px-2 py-2 text-right tabular-nums ${group.colorClass}`}>
                      {formatNumber(value.productActual)}
                    </td>
                    <td className="border border-gray-200 px-2 py-2 text-right tabular-nums text-gray-600">
                      {formatNumber(value.productPlan)}
                    </td>
                    <td className={`border border-gray-200 px-2 py-2 text-right tabular-nums ${
                      typeof value.achievementRate === 'number' && value.achievementRate >= 1
                        ? 'text-green-700'
                        : 'text-amber-700'
                    }`}>
                      {formatRate(value.achievementRate)}
                    </td>
                    {group.key === 'TOTAL' && (
                      <>
                        <td className="border border-gray-200 px-2 py-2 text-right tabular-nums text-orange-700">
                          {formatNumber(value.billetActual)}
                        </td>
                        <td className="border border-gray-200 px-2 py-2 text-right tabular-nums text-fuchsia-700">
                          {formatNumber(value.coggingActual)}
                        </td>
                        <td className="border border-gray-200 px-2 py-2 text-right tabular-nums text-slate-900">
                          {formatNumber(value.grossTotal)}
                        </td>
                      </>
                    )}
                  </React.Fragment>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function EditableWorkbookCell({
  cell,
  column,
  row,
  address,
  onChange,
}: {
  cell: TemplateWorkbookCell | undefined;
  column: string;
  row: TemplateWorkbookRow;
  address: string;
  onChange: (rowNumber: number, column: string, value: string | number | null) => void;
}) {
  const displayValue = formatCellValue(cell, column, row);
  const [value, setValue] = React.useState(displayValue);

  React.useEffect(() => {
    setValue(displayValue);
  }, [displayValue]);

  const commit = () => {
    const parsedValue = parseWorkbookInputValue(value, cell, column);
    const currentValue = cell?.value ?? null;
    if (parsedValue === currentValue) return;
    onChange(row.row_number, column, parsedValue);
  };

  return (
    <input
      value={value}
      onChange={event => setValue(event.target.value)}
      onBlur={commit}
      onKeyDown={event => {
        if (event.key === 'Enter') {
          event.currentTarget.blur();
        }
      }}
      title={getCellTitle(cell, address)}
      className={`w-full h-7 px-1.5 rounded border text-xs tabular-nums focus:outline-none focus:ring-2 focus:ring-blue-400 ${
        typeof cell?.value === 'number' ? 'text-right' : 'text-left'
      } ${cell?.formula ? 'bg-amber-50 border-amber-200' : 'bg-white border-gray-200'}`}
    />
  );
}

const OUTPUT_PLAN_COLUMNS = new Set(['C', 'Q', 'AE', 'AQ']);

type MergedCellLayout = {
  spans: Map<string, { colSpan: number; rowSpan: number }>;
  coveredCells: Set<string>;
};

function getCellKey(rowNumber: number, column: string) {
  return `${rowNumber}:${column}`;
}

function buildMergedCellLayout(
  sheet: TemplateWorkbookSheet,
  columns: string[],
  rows: TemplateWorkbookRow[],
  enabled: boolean
): MergedCellLayout {
  const spans = new Map<string, { colSpan: number; rowSpan: number }>();
  const coveredCells = new Set<string>();

  if (!enabled) return { spans, coveredCells };

  const columnNumbers = new Map(columns.map(column => [column, columnToNumber(column)]));

  getTemplateMergedCells(sheet).forEach(range => {
    const startColumnNumber = columnToNumber(range.startColumn);
    const endColumnNumber = columnToNumber(range.endColumn);
    const visibleColumns = columns.filter(column => {
      const columnNumber = columnNumbers.get(column);
      return (
        typeof columnNumber === 'number' &&
        columnNumber >= startColumnNumber &&
        columnNumber <= endColumnNumber
      );
    });
    const visibleRows = rows.filter(row => row.row_number >= range.startRow && row.row_number <= range.endRow);

    if (visibleColumns.length === 0 || visibleRows.length === 0) return;

    const anchorRow = visibleRows[0];
    const anchorColumn = visibleColumns[0];
    const anchorKey = getCellKey(anchorRow.row_number, anchorColumn);

    spans.set(anchorKey, {
      colSpan: visibleColumns.length,
      rowSpan: visibleRows.length,
    });

    visibleRows.forEach(row => {
      visibleColumns.forEach(column => {
        const key = getCellKey(row.row_number, column);
        if (key !== anchorKey) coveredCells.add(key);
      });
    });
  });

  return { spans, coveredCells };
}

function RawTable({
  sheet,
  columns,
  rows,
  editable = false,
  showCoordinates = false,
  showGridHeaders = true,
  useMergedCells = false,
  onCellChange,
  onDeleteRow,
}: {
  sheet: TemplateWorkbookSheet;
  columns: string[];
  rows?: TemplateWorkbookRow[];
  editable?: boolean;
  showCoordinates?: boolean;
  showGridHeaders?: boolean;
  useMergedCells?: boolean;
  onCellChange?: (rowNumber: number, column: string, value: string | number | null) => void;
  onDeleteRow?: (rowNumber: number) => void;
}) {
  const displayRows = rows ?? sheet.rows;
  const mergedCellLayout = React.useMemo(
    () => buildMergedCellLayout(sheet, columns, displayRows, useMergedCells),
    [columns, displayRows, sheet, useMergedCells]
  );

  return (
    <div className="template-print-sheet overflow-auto max-h-[calc(100vh-360px)] print-sheet">
      <table className={`template-raw-print-table min-w-max w-full border-collapse text-xs ${useMergedCells ? 'template-output-workbook-table' : ''}`}>
        {showGridHeaders && (
          <thead>
            <tr>
              {editable && (
                <th className="sticky top-0 left-0 z-40 bg-slate-900 text-white border border-slate-700 px-2 py-2 text-center w-12 no-print">
                  삭제
                </th>
              )}
              <th className={`sticky top-0 ${editable ? 'left-12' : 'left-0'} z-30 bg-slate-900 text-white border border-slate-700 px-2 py-2 text-center w-14`}>
                {showCoordinates ? '행 \\ 열' : '행'}
              </th>
              {columns.map(column => (
                <th
                  key={column}
                  className="sticky top-0 z-20 bg-blue-800 text-white border border-blue-700 px-2 py-2 text-center min-w-[86px]"
                >
                  <div className="font-semibold">{showCoordinates ? `열 ${column}` : column}</div>
                </th>
              ))}
            </tr>
          </thead>
        )}
        <tbody>
          {displayRows.map(row => {
            const cellMap = getCellMap(row);

            return (
              <tr key={row.row_number} className="odd:bg-white even:bg-slate-50 hover:bg-blue-50">
                {showGridHeaders && editable && (
                  <td className="sticky left-0 z-20 bg-white border border-gray-200 px-1.5 py-1.5 text-center no-print">
                    <button
                      type="button"
                      onClick={() => onDeleteRow?.(row.row_number)}
                      className="p-1.5 rounded-lg text-red-600 hover:bg-red-50"
                      title="행 삭제"
                    >
                      <Trash2 size={14} />
                    </button>
                  </td>
                )}
                {showGridHeaders && (
                  <td className={`sticky ${editable ? 'left-12' : 'left-0'} z-10 bg-slate-100 border border-gray-200 px-2 py-1.5 text-center font-semibold text-gray-600 tabular-nums`}>
                    {showCoordinates ? `행 ${row.row_number}` : row.row_number}
                  </td>
                )}
                {columns.map(column => {
                  const cellKey = getCellKey(row.row_number, column);
                  if (mergedCellLayout.coveredCells.has(cellKey)) return null;

                  const cell = cellMap[column];
                  const value = formatCellValue(cell, column, row);
                  const address = getCellAddress(row.row_number, column);
                  const formula = cell?.formula ? `=${cell.formula}` : null;
                  const canEditCell = editable && onCellChange && !cell?.formula;
                  const mergeSpan = mergedCellLayout.spans.get(cellKey);
                  const alignmentClass = useMergedCells
                    ? 'text-center align-middle'
                    : typeof cell?.value === 'number'
                      ? 'text-right align-top'
                      : 'text-left align-top';
                  const planColumnClass = useMergedCells && OUTPUT_PLAN_COLUMNS.has(column) ? 'template-plan-column' : '';

                  return (
                    <td
                      key={`${row.row_number}-${column}`}
                      colSpan={mergeSpan && mergeSpan.colSpan > 1 ? mergeSpan.colSpan : undefined}
                      rowSpan={mergeSpan && mergeSpan.rowSpan > 1 ? mergeSpan.rowSpan : undefined}
                      title={getCellTitle(cell, address)}
                      className={`border border-gray-200 px-2 py-1.5 min-h-8 tabular-nums ${alignmentClass} ${planColumnClass} ${
                        cell?.formula ? 'bg-amber-50/70' : ''
                      }`}
                    >
                      {showCoordinates && (
                        <div className="mb-1 flex items-center justify-between gap-1 text-[10px] leading-none">
                          <span className="rounded bg-slate-100 px-1 py-0.5 font-semibold text-slate-500">
                            {address}
                          </span>
                          {formula && (
                            <span className="rounded bg-amber-100 px-1 py-0.5 font-semibold text-amber-700">
                              수식
                            </span>
                          )}
                        </div>
                      )}
                      {canEditCell ? (
                        <EditableWorkbookCell
                          cell={cell}
                          column={column}
                          row={row}
                          address={address}
                          onChange={onCellChange}
                        />
                      ) : (
                        <div className={cell?.formula ? 'font-semibold text-slate-800' : ''}>
                          {value}
                        </div>
                      )}
                      {showCoordinates && formula && (
                        <div className="mt-1 max-w-[140px] truncate text-left text-[10px] leading-tight text-amber-700" title={formula}>
                          {formula}
                        </div>
                      )}
                    </td>
                  );
                })}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function ExcelPreviewDialog({
  sheets,
  initialSheetId,
  onClose,
  onDownload,
  onPrint,
}: {
  sheets: TemplateWorkbookSheet[];
  initialSheetId: string;
  onClose: () => void;
  onDownload: () => void;
  onPrint: () => void;
}) {
  const [previewSheetId, setPreviewSheetId] = React.useState(initialSheetId);
  const previewSheet = sheets.find(sheet => sheet.id === previewSheetId) ?? sheets[0];
  const previewVisibleRows = React.useMemo(() => getVisibleTemplateRows(previewSheet), [previewSheet]);
  const previewColumns = React.useMemo(() => getVisibleSheetColumns(previewSheet), [previewSheet]);

  React.useEffect(() => {
    if (!sheets.length) return;
    if (!previewSheetId || !sheets.some(sheet => sheet.id === previewSheetId)) {
      setPreviewSheetId(sheets[0].id);
    }
  }, [previewSheetId, sheets]);

  return (
    <div className="template-preview-print-modal fixed inset-0 z-50 bg-slate-900/55 flex items-center justify-center p-4">
      <div className="template-preview-dialog bg-white rounded-lg shadow-xl border border-gray-200 w-[min(1180px,96vw)] max-h-[92vh] flex flex-col overflow-hidden">
        <div className="template-preview-controls no-print px-5 py-4 border-b border-gray-100 flex items-center gap-3">
          <div className="min-w-0">
            <h2 className="text-lg font-bold text-gray-900">엑셀 미리보기</h2>
            <p className="text-xs text-gray-500 mt-0.5">
              {previewSheet?.sheet_name ?? '-'} · {previewVisibleRows.length.toLocaleString('ko-KR')}행
            </p>
          </div>
          <button
            onClick={onClose}
            className="ml-auto p-1.5 rounded-lg text-gray-500 hover:bg-gray-100 hover:text-gray-800"
            title="닫기"
          >
            <X size={18} />
          </button>
        </div>

        <div className="template-preview-controls no-print px-5 py-3 border-b border-gray-100 flex gap-2 overflow-x-auto">
          {sheets.map(sheet => (
            <button
              key={sheet.id}
              type="button"
              onClick={() => setPreviewSheetId(sheet.id)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium whitespace-nowrap border transition-colors ${
                previewSheet?.id === sheet.id
                  ? 'bg-blue-700 text-white border-blue-700'
                  : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50'
              }`}
            >
              {sheet.sheet_name}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-auto p-5 bg-slate-50">
          {previewSheet ? (
            <div className="template-preview-print-area bg-white border border-gray-200 rounded-lg overflow-hidden">
              <div className="template-preview-print-header template-print-header hidden">
                <h2 className="font-semibold text-gray-900">{previewSheet.sheet_name}</h2>
                <p className="text-xs text-gray-500 mt-0.5">
                  {previewSheet.year}년 · {previewSheet.kind === 'monthly' ? '월별' : '연간'}
                </p>
              </div>
              <RawTable
                sheet={previewSheet}
                columns={previewColumns}
                rows={previewVisibleRows}
                showGridHeaders={false}
                useMergedCells
              />
            </div>
          ) : (
            <div className="bg-white border border-gray-200 rounded-lg px-4 py-10 text-center text-sm text-gray-500">
              미리볼 생산량집계 데이터가 없습니다.
            </div>
          )}
        </div>

        <div className="template-preview-controls no-print px-5 py-4 border-t border-gray-100 flex items-center justify-end gap-2">
          <button onClick={onClose} className="btn-secondary">
            닫기
          </button>
          <button onClick={onPrint} disabled={!previewSheet} className="btn-secondary flex items-center gap-2">
            <Printer size={16} />
            출력
          </button>
          <button onClick={onDownload} disabled={sheets.length === 0} className="btn-primary flex items-center gap-2">
            <Download size={16} />
            엑셀 다운로드
          </button>
        </div>
      </div>
    </div>
  );
}

export default function TemplateWorkbookPage() {
  const {
    templateSheets,
    hydrateStorage,
    isHydrating,
    storageMode,
    lastSyncedAt,
    getCurrentUser,
    updateTemplateWorkbookCell,
    deleteTemplateWorkbookRow,
    addTemplateWorkbookRow,
  } = useReportStore();
  const currentUser = getCurrentUser();
  const canManageWorkbook = currentUser?.role === 'admin' || Boolean(currentUser?.can_edit);
  const [selectedSheetId, setSelectedSheetId] = React.useState<string>('');
  const [viewMode, setViewMode] = React.useState<ViewMode>('summary');
  const [isExcelPreviewOpen, setIsExcelPreviewOpen] = React.useState(false);
  const selectedSheet = templateSheets.find(sheet => sheet.id === selectedSheetId) ?? templateSheets[0];
  const appSummary = React.useMemo(() => buildTemplateWorkbookAppSummary(templateSheets), [templateSheets]);
  const summaryRows = React.useMemo(() => extractTemplateSummaryRows(selectedSheet), [selectedSheet]);
  const rawColumns = React.useMemo(() => getSheetColumns(selectedSheet), [selectedSheet]);
  const printColumns = React.useMemo(() => getVisibleSheetColumns(selectedSheet), [selectedSheet]);
  const printRows = React.useMemo(() => getVisibleTemplateRows(selectedSheet), [selectedSheet]);
  const compactColumns = React.useMemo(() => getCompactSheetColumns(selectedSheet), [selectedSheet]);
  const visibleColumns = viewMode === 'raw' ? rawColumns : compactColumns;
  const totalRows = templateSheets.reduce((sum, sheet) => sum + sheet.rows.length, 0);
  const totalCells = templateSheets.reduce(
    (sum, sheet) => sum + sheet.rows.reduce((rowSum, row) => rowSum + row.cells.length, 0),
    0
  );

  React.useEffect(() => {
    if (typeof document === 'undefined') return undefined;

    document.documentElement.classList.add(PRINT_DOCUMENT_CLASS);
    document.body.classList.add(PRINT_DOCUMENT_CLASS);
    ensureLandscapePrintStyle();

    return () => {
      document.documentElement.classList.remove(PRINT_DOCUMENT_CLASS);
      document.documentElement.classList.remove(PREVIEW_PRINTING_CLASS);
      document.body.classList.remove(PRINT_DOCUMENT_CLASS);
      document.body.classList.remove(PREVIEW_PRINTING_CLASS);
      document.getElementById(PRINT_PAGE_STYLE_ID)?.remove();
    };
  }, []);

  React.useEffect(() => {
    if (!templateSheets.length) return;
    if (!selectedSheetId || !templateSheets.some(sheet => sheet.id === selectedSheetId)) {
      setSelectedSheetId(templateSheets[0].id);
    }
  }, [selectedSheetId, templateSheets]);

  const handleTemplateDownload = async () => {
    try {
      await downloadTemplateWorkbook(templateSheets);
    } catch {
      window.alert('생산량집계 엑셀 파일을 다운로드할 수 없습니다.');
    }
  };

  const handlePreviewDownload = () => {
    void handleTemplateDownload();
    setIsExcelPreviewOpen(false);
  };

  const handleWorkbookCellChange = (rowNumber: number, column: string, value: string | number | null) => {
    if (!selectedSheet || !canManageWorkbook) return;
    updateTemplateWorkbookCell(selectedSheet.id, rowNumber, column, value);
  };

  const handleWorkbookRowDelete = (rowNumber: number) => {
    if (!selectedSheet || !canManageWorkbook) return;
    const confirmed = window.confirm(`${selectedSheet.sheet_name} ${rowNumber}행을 삭제할까요?`);
    if (!confirmed) return;
    deleteTemplateWorkbookRow(selectedSheet.id, rowNumber);
  };

  const handleWorkbookRowAdd = () => {
    if (!selectedSheet || !canManageWorkbook) return;
    addTemplateWorkbookRow(selectedSheet.id);
  };

  const handlePrint = () => {
    printTemplateWorkbook();
  };

  const handlePreviewPrint = () => {
    printTemplateWorkbook({ preview: true });
  };

  return (
    <div className="template-print-page space-y-5 fade-in">
      <div className="flex items-center justify-between flex-wrap gap-3 no-print">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">생산량집계</h1>
          <p className="text-sm text-gray-500 mt-0.5">월별·연간 생산량 값을 앱 기준 집계로 정리</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => void hydrateStorage()}
            disabled={isHydrating}
            className="btn-secondary flex items-center gap-2"
          >
            <RefreshCw size={16} className={isHydrating ? 'animate-spin' : ''} />
            새로고침
          </button>
          <button
            onClick={() => setIsExcelPreviewOpen(true)}
            disabled={templateSheets.length === 0}
            className="btn-secondary flex items-center gap-2"
          >
            <Eye size={16} />
            엑셀 미리보기
          </button>
          <button onClick={handlePrint} className="btn-primary flex items-center gap-2">
            <Printer size={16} />
            출력
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 no-print">
        <div className="kpi-card">
          <span className="text-xs text-gray-500">저장 방식</span>
          <span className="text-lg font-bold text-gray-900">
            {storageMode === 'supabase' ? '서버' : '로컬'}
          </span>
        </div>
        <div className="kpi-card">
          <span className="text-xs text-gray-500">시트</span>
          <span className="text-lg font-bold text-blue-700">{templateSheets.length.toLocaleString('ko-KR')}개</span>
        </div>
        <div className="kpi-card">
          <span className="text-xs text-gray-500">원본 행 / 셀</span>
          <span className="text-lg font-bold text-gray-900">
            {totalRows.toLocaleString('ko-KR')} / {totalCells.toLocaleString('ko-KR')}
          </span>
        </div>
        <div className="kpi-card">
          <span className="text-xs text-gray-500">동기화</span>
          <span className="text-lg font-bold text-gray-900">{lastSyncedAt ? formatImportedAt(lastSyncedAt) : '-'}</span>
        </div>
      </div>

      {templateSheets.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_auto] gap-3 no-print">
          <div className="flex gap-2 overflow-x-auto pb-1">
            {templateSheets.map(sheet => (
              <button
                key={sheet.id}
                type="button"
                onClick={() => setSelectedSheetId(sheet.id)}
                className={`px-3 py-2 rounded-lg text-sm font-medium whitespace-nowrap border transition-colors ${
                  selectedSheet?.id === sheet.id
                    ? 'bg-blue-700 text-white border-blue-700'
                    : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50'
                }`}
              >
                {sheet.sheet_name}
              </button>
            ))}
          </div>

          <div className="inline-flex rounded-lg border border-gray-200 bg-white p-1 h-fit">
            {[
              { id: 'summary' as const, label: '요약', icon: BarChart3 },
              { id: 'compact' as const, label: '핵심 셀', icon: Table2 },
              { id: 'raw' as const, label: '원본', icon: Grid2X2 },
            ].map(item => (
              <button
                key={item.id}
                type="button"
                onClick={() => setViewMode(item.id)}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                  viewMode === item.id
                    ? 'bg-blue-700 text-white'
                    : 'text-gray-600 hover:bg-gray-50'
                }`}
              >
                <item.icon size={15} />
                {item.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {templateSheets.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-5 gap-3 no-print">
          <SummaryMetricCard
            label="2026 상반기 제품"
            value={formatNumber(appSummary.total.productActual)}
            accentClass="text-blue-700"
          />
          <SummaryMetricCard
            label="2026 상반기 계획"
            value={formatNumber(appSummary.total.productPlan)}
            accentClass="text-gray-900"
          />
          <SummaryMetricCard
            label="2026 상반기 달성"
            value={formatRate(appSummary.total.achievementRate)}
            accentClass={typeof appSummary.total.achievementRate === 'number' && appSummary.total.achievementRate >= 1 ? 'text-green-700' : 'text-amber-700'}
          />
          <SummaryMetricCard
            label="2026 상반기 황지"
            value={formatNumber(appSummary.total.billetActual)}
            accentClass="text-orange-700"
          />
          <SummaryMetricCard
            label="2026 상반기 코깅"
            value={formatNumber(appSummary.total.coggingActual)}
            accentClass="text-fuchsia-700"
          />
        </div>
      )}

      {!selectedSheet ? (
        <div className="card">
          <div className="card-body text-center text-gray-500 py-12">
            서버에 저장된 생산량집계 데이터가 없습니다.
          </div>
        </div>
      ) : (
        <div className="card print-area template-print-area">
          <div className="card-header flex-wrap gap-3 template-print-header">
            <div>
              <h2 className="font-semibold text-gray-900">{selectedSheet.sheet_name}</h2>
              <p className="text-xs text-gray-500 mt-0.5">
                {selectedSheet.year}년 · {selectedSheet.kind === 'monthly' ? '월별' : '연간'} · 가져온 시각 {formatImportedAt(selectedSheet.imported_at)}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <span className="badge badge-blue">
                요약 {summaryRows.length.toLocaleString('ko-KR')}행
              </span>
              {canManageWorkbook && viewMode !== 'summary' && (
                <button
                  type="button"
                  onClick={handleWorkbookRowAdd}
                  className="btn-secondary text-xs px-2.5 py-1.5 flex items-center gap-1 no-print"
                >
                  <Plus size={14} />
                  행 추가
                </button>
              )}
              {summaryRows.some(hasWarningValue) && (
                <span className="badge badge-warning">수식 확인</span>
              )}
            </div>
          </div>

          <div className="template-screen-workbook-content">
            {viewMode === 'summary' ? (
              <SummaryTable rows={summaryRows} />
            ) : (
              <RawTable
                sheet={selectedSheet}
                columns={visibleColumns}
                editable={canManageWorkbook}
                showCoordinates={viewMode === 'raw'}
                onCellChange={handleWorkbookCellChange}
                onDeleteRow={handleWorkbookRowDelete}
              />
            )}
          </div>
          <div className="template-print-workbook-content">
            <RawTable
              sheet={selectedSheet}
              columns={printColumns}
              rows={printRows}
              showGridHeaders={false}
              useMergedCells
            />
          </div>
        </div>
      )}

      {isExcelPreviewOpen && (
        <ExcelPreviewDialog
          sheets={templateSheets}
          initialSheetId={selectedSheet?.id ?? templateSheets[0]?.id ?? ''}
          onClose={() => setIsExcelPreviewOpen(false)}
          onDownload={handlePreviewDownload}
          onPrint={handlePreviewPrint}
        />
      )}
    </div>
  );
}
