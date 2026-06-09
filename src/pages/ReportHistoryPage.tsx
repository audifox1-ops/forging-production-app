import React from 'react';
import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';
import { Plus, FileText, Calendar, Eye, Printer, Copy } from 'lucide-react';
import { useReportStore } from '../store/reportStore';
import { calcDashboardSummary } from '../utils/calculations';
import { STATUS_LABELS } from '../types';
import SubmitStatusBadge from '../components/SubmitStatusBadge';
import {
  getActualDateFromPlanDate,
  getReportPlanDate,
  getTodayPlanDate,
} from '../utils/reportDates';

export default function ReportHistoryPage() {
  const navigate = useNavigate();
  const { reports, getEntriesByReport, createReport, getCurrentUser } = useReportStore();
  const currentUser = getCurrentUser();
  const isAdmin = currentUser?.role === 'admin';
  const canWrite = isAdmin || Boolean(currentUser?.can_write);
  const canEdit = isAdmin || Boolean(currentUser?.can_edit);
  const canCreateReport = canWrite || canEdit;

  const sortedReports = [...reports].sort(
    (a, b) => new Date(getReportPlanDate(b)).getTime() - new Date(getReportPlanDate(a)).getTime()
  );

  const handleCreate = () => {
    if (!canCreateReport) return;
    const report = createReport(getActualDateFromPlanDate(getTodayPlanDate()));
    navigate(`/reports/${report.report_date}/input`);
  };

  const handleCopy = (reportDate: string) => {
    if (!canCreateReport) return;
    const newDate = getActualDateFromPlanDate(getTodayPlanDate());
    const report = createReport(newDate, { sourceReportDate: reportDate });
    navigate(`/reports/${report.report_date}/input`);
  };

  return (
    <div className="space-y-5 fade-in">
      {/* 헤더 */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">보고 이력</h1>
          <p className="text-sm text-gray-500 mt-0.5">날짜별 생산 보고서 목록</p>
        </div>
        <button onClick={handleCreate} disabled={!canCreateReport} className="btn-primary flex items-center gap-2">
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
                        {format(new Date(report.report_date), 'yyyy.MM.dd (eee)', { locale: ko })}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-gray-500">
                      {format(new Date(getReportPlanDate(report)), 'yyyy.MM.dd (eee)', { locale: ko })}
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
                          onClick={() => handleCopy(report.report_date)}
                          disabled={!canCreateReport}
                          className="p-1.5 text-gray-500 hover:bg-gray-100 rounded-lg transition-colors"
                          title="복사해서 새 보고서 생성"
                        >
                          <Copy size={15} />
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
    </div>
  );
}
