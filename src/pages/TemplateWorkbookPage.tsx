import React from 'react';
import { Download, Printer, RefreshCw } from 'lucide-react';
import { useReportStore } from '../store/reportStore';
import { downloadExcelTemplate } from '../utils/excelTemplate';
import type { TemplateWorkbookCell, TemplateWorkbookRow, TemplateWorkbookSheet } from '../types';

const PERCENT_COLUMNS = new Set(['D', 'R', 'AF', 'AR']);

function columnToNumber(column: string) {
  return column.split('').reduce((value, char) => value * 26 + char.charCodeAt(0) - 64, 0);
}

function getSheetColumns(sheet: TemplateWorkbookSheet | undefined) {
  if (!sheet) return [];

  const columns = new Set<string>();
  sheet.rows.forEach(row => {
    row.cells.forEach(cell => columns.add(cell.column));
  });

  return Array.from(columns).sort((a, b) => columnToNumber(a) - columnToNumber(b));
}

function getCellMap(row: TemplateWorkbookRow) {
  return row.cells.reduce<Record<string, TemplateWorkbookCell>>((acc, cell) => {
    acc[cell.column] = cell;
    return acc;
  }, {});
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
      return `${(cell.value * 100).toLocaleString('ko-KR', { maximumFractionDigits: 1 })}%`;
    }

    return cell.value.toLocaleString('ko-KR', {
      maximumFractionDigits: Number.isInteger(cell.value) ? 0 : 4,
    });
  }

  return cell.value;
}

function getCellTitle(cell: TemplateWorkbookCell | undefined) {
  if (!cell?.formula) return undefined;
  return `=${cell.formula}`;
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

export default function TemplateWorkbookPage() {
  const { templateSheets, hydrateStorage, isHydrating, storageMode, lastSyncedAt } = useReportStore();
  const [selectedSheetId, setSelectedSheetId] = React.useState<string>('');
  const selectedSheet = templateSheets.find(sheet => sheet.id === selectedSheetId) ?? templateSheets[0];
  const columns = React.useMemo(() => getSheetColumns(selectedSheet), [selectedSheet]);
  const totalRows = templateSheets.reduce((sum, sheet) => sum + sheet.rows.length, 0);
  const totalCells = templateSheets.reduce(
    (sum, sheet) => sum + sheet.rows.reduce((rowSum, row) => rowSum + row.cells.length, 0),
    0
  );

  React.useEffect(() => {
    if (!templateSheets.length) return;
    if (!selectedSheetId || !templateSheets.some(sheet => sheet.id === selectedSheetId)) {
      setSelectedSheetId(templateSheets[0].id);
    }
  }, [selectedSheetId, templateSheets]);

  const handleTemplateDownload = async () => {
    try {
      await downloadExcelTemplate();
    } catch {
      window.alert('템플릿 엑셀 파일을 다운로드할 수 없습니다.');
    }
  };

  return (
    <div className="space-y-5 fade-in">
      <div className="flex items-center justify-between flex-wrap gap-3 no-print">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">템플릿 집계</h1>
          <p className="text-sm text-gray-500 mt-0.5">서버에 저장된 월별·연간 템플릿 시트</p>
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
          <button onClick={handleTemplateDownload} className="btn-secondary flex items-center gap-2">
            <Download size={16} />
            원본 엑셀
          </button>
          <button onClick={() => window.print()} className="btn-primary flex items-center gap-2">
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
          <span className="text-xs text-gray-500">행 / 셀</span>
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
        <div className="flex gap-2 overflow-x-auto pb-1 no-print">
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
      )}

      {!selectedSheet ? (
        <div className="card">
          <div className="card-body text-center text-gray-500 py-12">
            서버에 저장된 템플릿 시트 데이터가 없습니다.
          </div>
        </div>
      ) : (
        <div className="card print-area">
          <div className="card-header flex-wrap gap-3">
            <div>
              <h2 className="font-semibold text-gray-900">{selectedSheet.sheet_name}</h2>
              <p className="text-xs text-gray-500 mt-0.5">
                {selectedSheet.year}년 · {selectedSheet.kind === 'monthly' ? '월별' : '연간'} · 가져온 시각 {formatImportedAt(selectedSheet.imported_at)}
              </p>
            </div>
            <span className="badge badge-blue">
              {selectedSheet.rows.length.toLocaleString('ko-KR')}행
            </span>
          </div>

          <div className="overflow-auto max-h-[calc(100vh-320px)] print-sheet">
            <table className="min-w-max w-full border-collapse text-xs">
              <thead>
                <tr>
                  <th className="sticky top-0 left-0 z-30 bg-blue-900 text-white border border-blue-700 px-2 py-2 text-center w-14">
                    행
                  </th>
                  {columns.map(column => (
                    <th
                      key={column}
                      className="sticky top-0 z-20 bg-blue-800 text-white border border-blue-700 px-2 py-2 text-center min-w-[72px]"
                    >
                      {column}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {selectedSheet.rows.map(row => {
                  const cellMap = getCellMap(row);

                  return (
                    <tr key={row.row_number} className="odd:bg-white even:bg-slate-50 hover:bg-blue-50">
                      <td className="sticky left-0 z-10 bg-slate-100 border border-gray-200 px-2 py-1.5 text-center font-semibold text-gray-600 tabular-nums">
                        {row.row_number}
                      </td>
                      {columns.map(column => {
                        const cell = cellMap[column];
                        const value = formatCellValue(cell, column, row);

                        return (
                          <td
                            key={`${row.row_number}-${column}`}
                            title={getCellTitle(cell)}
                            className={`border border-gray-200 px-2 py-1.5 h-8 tabular-nums ${
                              typeof cell?.value === 'number' ? 'text-right' : 'text-left'
                            } ${cell?.formula ? 'bg-amber-50/70' : ''}`}
                          >
                            {value}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
