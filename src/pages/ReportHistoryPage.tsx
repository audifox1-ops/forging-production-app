import React from 'react';
import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';
import { Plus, FileText, Calendar, Eye, Printer, Copy, Download, X, Trash2, AlertTriangle } from 'lucide-react';
import { useReportStore } from '../store/reportStore';
import { calcDashboardSummary } from '../utils/calculations';
import { STATUS_LABELS } from '../types';
import SubmitStatusBadge from '../components/SubmitStatusBadge';
import { useToast } from '../components/Toast';
import {
  getActualDateFromPlanDate,
  getReportPlanDate,
  getTodayPlanDate,
  getDayName,
  isWeekend,
} from '../utils/reportDates';
import { downloadReportExcel } from '../utils/excelTemplate';
import type { ProductionReport } from '../types';

// ────────────────────────────────────────────────────────────
// 보고서 삭제 확인 다이얼로그
// ────────────────────────────────────────────────────────────
function DeleteReportDialog({
  report,
  onClose,
  onConfirm,
}: {
  report: ProductionReport | null;
  onClose: () => void;
  onConfirm: () => void;
}) {
  if (!report) return null;

  const isFinalized =
    report.status === 'submitted' || report.status === 'reviewed';

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/55 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-2xl border border-gray-200 w-[min(480px,96vw)] overflow-hidden">
        {/* 헤더 */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-red-100 bg-red-50">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-red-100 flex items-center justify-center">
              <Trash2 size={18} className="text-red-600" />
            </div>
            <div>
              <h2 className="text-base font-bold text-gray-900">보고서 삭제</h2>
              <p className="text-xs text-gray-500 mt-0.5">
                {format(new Date(report.report_date), 'yyyy년 MM월 dd일', { locale: ko })} ({getDayName(report.report_date)}요일) 보고서
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100">
            <X size={18} />
          </button>
        </div>

        {/* 본문 */}
        <div className="px-6 py-5 space-y-4">
          <p className="text-sm text-gray-700">
            이 보고서와 연결된 <strong>모든 실적 데이터(입력값 포함)</strong>가 영구적으로 삭제됩니다.
            삭제 후에는 복구할 수 없습니다.
          </p>

          {isFinalized && (
            <div className="flex items-start gap-2.5 p-3 rounded-lg bg-amber-50 border border-amber-200">
              <AlertTriangle size={16} className="text-amber-600 flex-shrink-0 mt-0.5" />
              <p className="text-xs text-amber-800 font-medium">
                현재 이 보고서는 <strong>'{STATUS_LABELS[report.status]}'</strong> 상태입니다.
                제출 또는 검토가 완료된 보고서를 삭제하면 집계 데이터에 영향을 줄 수 있습니다.
              </p>
            </div>
          )}
        </div>

        {/* 버튼 */}
        <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-gray-100 bg-gray-50">
          <button onClick={onClose} className="btn-secondary">취소</button>
          <button
            onClick={onConfirm}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-red-600 text-white text-sm font-semibold hover:bg-red-700 transition-colors"
          >
            <Trash2 size={15} />
            삭제 확인
          </button>
        </div>
      </div>
    </div>
  );
}

function CreateReportDialog({
  isOpen,
  onClose,
  onConfirm,
  defaultActualDate,
  defaultPlanDate,
  sourceReportDate,
}: {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (actualDate: string) => void;
  defaultActualDate: string;
  defaultPlanDate: string;
  sourceReportDate?: string;
}) {
  const [actualDate, setActualDate] = React.useState(defaultActualDate);

  React.useEffect(() => {
    if (isOpen) setActualDate(defaultActualDate);
  }, [isOpen, defaultActualDate]);

  if (!isOpen) return null;

  const actualDayName = getDayName(actualDate);
  const isWeekendSelected = isWeekend(actualDate);

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/55 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-2xl border border-gray-200 w-[min(480px,96vw)] overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div>
            <h2 className="text-lg font-bold text-gray-900">
              {sourceReportDate ? '보고서 복사' : '새 보고서 작성'}
            </h2>
            <p className="text-xs text-gray-500 mt-0.5">
              금일 계획일: {defaultPlanDate} ({getDayName(defaultPlanDate)}요일)
            </p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100">
            <X size={18} />
          </button>
        </div>

        <div className="px-6 py-5 space-y-4">
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">전일 실적일</label>
            <input
              type="date"
              value={actualDate}
              onChange={e => setActualDate(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <div className="flex items-center gap-2 mt-2">
              <span className="text-sm text-gray-600">
                선택한 날짜: {actualDate} ({actualDayName}요일)
              </span>
              {isWeekendSelected && (
                <span className="text-xs text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full">
                  주말입니다
                </span>
              )}
            </div>
          </div>

          {sourceReportDate && (
            <div className="text-xs text-gray-500 bg-gray-50 rounded-lg p-3">
              <strong>복사 원본:</strong> {sourceReportDate} ({getDayName(sourceReportDate)}요일)
              <br />
              원본 보고서의 실적 데이터가 새 보고서에 복사됩니다.
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-gray-100 bg-gray-50">
          <button onClick={onClose} className="btn-secondary">취소</button>
          <button
            onClick={() => onConfirm(actualDate)}
            className="btn-primary flex items-center gap-2"
          >
            {sourceReportDate ? '복사해서 만들기' : '보고서 만들기'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function ReportHistoryPage() {
  const navigate = useNavigate();
  const { reports, getEntriesByReport, createReport, deleteReport, getCurrentUser } = useReportStore();
  const { showToast } = useToast();
  const currentUser = getCurrentUser();
  const isAdmin = currentUser?.role === 'admin';
  const canWrite = isAdmin || Boolean(currentUser?.can_write);
  const canEdit = isAdmin || Boolean(currentUser?.can_edit);
  const canDelete = isAdmin || Boolean(currentUser?.can_delete);
  const canCreateReport = canWrite || canEdit;

  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [copySourceDate, setCopySourceDate] = React.useState<string | undefined>(undefined);
  const [deleteTarget, setDeleteTarget] = React.useState<ProductionReport | null>(null);

  const defaultActualDate = getActualDateFromPlanDate(getTodayPlanDate());
  const defaultPlanDate = getTodayPlanDate();

  const sortedReports = [...reports].sort(
    (a, b) => new Date(getReportPlanDate(b)).getTime() - new Date(getReportPlanDate(a)).getTime()
  );

  const handleOpenCreate = () => {
    if (!canCreateReport) return;
    setCopySourceDate(undefined);
    setDialogOpen(true);
  };

  const handleOpenCopy = (reportDate: string) => {
    if (!canCreateReport) return;
    setCopySourceDate(reportDate);
    setDialogOpen(true);
  };

  const handleConfirm = (actualDate: string) => {
    if (copySourceDate) {
      const report = createReport(actualDate, { sourceReportDate: copySourceDate });
      navigate(`/reports/${report.report_date}/input`);
    } else {
      const report = createReport(actualDate);
      navigate(`/reports/${report.report_date}/input`);
    }
    setDialogOpen(false);
  };

  const handleExcelDownload = async (report: ProductionReport) => {
    try {
      await downloadReportExcel(report, getEntriesByReport(report.id));
    } catch {
      window.alert('엑셀 보고서 파일을 다운로드할 수 없습니다.');
    }
  };

  const handleOpenDelete = (report: ProductionReport) => {
    if (!canDelete) return;
    setDeleteTarget(report);
  };

  const handleConfirmDelete = () => {
    if (!deleteTarget) return;
    deleteReport(deleteTarget.id);
    showToast(
      `${format(new Date(deleteTarget.report_date), 'yyyy.MM.dd', { locale: ko })} 보고서가 삭제되었습니다.`,
      'success'
    );
    setDeleteTarget(null);
  };

  return (
    <div className="space-y-5 fade-in">
      {/* 헤더 */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">보고 이력</h1>
          <p className="text-sm text-gray-500 mt-0.5">날짜별 생산 보고서 목록</p>
        </div>
        <button onClick={handleOpenCreate} disabled={!canCreateReport} className="btn-primary flex items-center gap-2">
          <Plus size={16} />
          {canCreateReport ? '새 보고서 작성' : '권한 필요'}
        </button>
      </div>

      {/* 보고서 목록 */}
      <div className="card">
        <div className="table-wrapper">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="px-4 py-3 text-left text-gray-600 font-semibold">전일 실적일</th>
                <th className="px-4 py-3 text-left text-gray-600 font-semibold">금일 계획일</th>
                <th className="px-4 py-3 text-center text-gray-600 font-semibold">상태</th>
                <th className="px-4 py-3 text-right text-gray-600 font-semibold">전체 계획</th>
                <th className="px-4 py-3 text-right text-gray-600 font-semibold">전체 실적</th>
                <th className="px-4 py-3 text-center text-gray-600 font-semibold">달성율</th>
                <th className="px-4 py-3 text-center text-gray-600 font-semibold">제출현황</th>
                <th className="px-4 py-3 text-center text-gray-600 font-semibold">작업</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {sortedReports.map(report => {
                const entries = getEntriesByReport(report.id);
                const summary = calcDashboardSummary(entries);
                const rate = summary.total_achievement_rate;

                return (
                  <tr key={report.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3 font-semibold text-gray-800">
                      <div className="flex items-center gap-2">
                        <Calendar size={14} className="text-gray-400" />
                        {format(new Date(report.report_date), 'yyyy.MM.dd', { locale: ko })}
                        <span className="text-xs text-gray-400">({getDayName(report.report_date)}요일)</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-gray-500">
                      {format(new Date(getReportPlanDate(report)), 'yyyy.MM.dd', { locale: ko })}
                      <span className="text-xs text-gray-400 ml-1">({getDayName(getReportPlanDate(report))}요일)</span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={`badge ${
                        report.status === 'reviewed' ? 'badge-normal' :
                          report.status === 'submitted' ? 'badge-blue' :
                            'badge-warning'
                      }`}>
                        {STATUS_LABELS[report.status]}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums">
                      {summary.total_plan.toLocaleString()} KG
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums">
                      {summary.total_actual.toLocaleString()} KG
                    </td>
                    <td className={`px-4 py-3 text-center font-bold tabular-nums ${
                      rate >= 100 ? 'text-green-600' :
                        rate >= 90 ? 'text-yellow-600' : 'text-red-600'
                    }`}>
                      {summary.total_plan > 0 ? `${rate.toFixed(1)}%` : '-'}
                    </td>
                    <td className="px-4 py-3 text-center text-xs text-gray-500">
                      {summary.submit_status_count.submitted}/{summary.submit_status_count.total}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-center gap-1">
                        <button
                          onClick={() => navigate(`/reports/${report.report_date}`)}
                          className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                          title="보고서 보기"
                        >
                          <Eye size={15} />
                        </button>
                        <button
                          onClick={() => navigate(`/reports/${report.report_date}/input`)}
                          className="p-1.5 text-gray-500 hover:bg-gray-100 rounded-lg transition-colors"
                          title="입력 화면"
                        >
                          <FileText size={15} />
                        </button>
                        <button
                          onClick={() => navigate(`/reports/${report.report_date}/print`)}
                          className="p-1.5 text-gray-500 hover:bg-gray-100 rounded-lg transition-colors"
                          title="출력"
                        >
                          <Printer size={15} />
                        </button>
                        <button
                          onClick={() => handleExcelDownload(report)}
                          className="p-1.5 text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors"
                          title="엑셀 다운로드"
                        >
                          <Download size={15} />
                        </button>
                        <button
                          onClick={() => handleOpenCopy(report.report_date)}
                          disabled={!canCreateReport}
                          className="p-1.5 text-gray-500 hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                          title="복사해서 새 보고서 생성"
                        >
                          <Copy size={15} />
                        </button>
                        <button
                          onClick={() => handleOpenDelete(report)}
                          disabled={!canDelete}
                          className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                          title={canDelete ? '보고서 삭제' : '삭제 권한이 없습니다'}
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}

              {sortedReports.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-4 py-10 text-center text-gray-400">
                    보고서 이력이 없습니다.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* 보고서 생성/복사 다이얼로그 */}
      <CreateReportDialog
        isOpen={dialogOpen}
        onClose={() => setDialogOpen(false)}
        onConfirm={handleConfirm}
        defaultActualDate={defaultActualDate}
        defaultPlanDate={defaultPlanDate}
        sourceReportDate={copySourceDate}
      />

      {/* 보고서 삭제 확인 다이얼로그 */}
      <DeleteReportDialog
        report={deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleConfirmDelete}
      />
    </div>
  );
}
