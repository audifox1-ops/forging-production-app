import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';
import { ArrowLeft, Printer } from 'lucide-react';
import { useReportStore } from '../store/reportStore';
import { calcDashboardSummary, formatNumber } from '../utils/calculations';
import { generateReportText } from '../utils/reportTextGenerator';

export default function AdminReportPage() {
  const { reportDate } = useParams<{ reportDate: string }>();
  const navigate = useNavigate();
  const { reports, getEntriesByReport } = useReportStore();

  const today = reportDate || format(new Date(), 'yyyy-MM-dd');
  const report = reports.find(r => r.report_date === today);
  const entries = report ? getEntriesByReport(report.id) : [];
  const summary = calcDashboardSummary(entries);
  const reportText = report ? generateReportText(summary, entries, today) : '';

  const handlePrint = () => navigate(`/reports/${today}/print`);

  if (!report) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-400">
        해당 날짜의 보고서를 찾을 수 없습니다.
      </div>
    );
  }

  return (
    <div className="space-y-5 fade-in max-w-5xl mx-auto">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate(-1)} className="btn-secondary p-2">
            <ArrowLeft size={16} />
          </button>
          <div>
            <h1 className="text-xl font-bold text-gray-900">보고서 미리보기</h1>
            <p className="text-sm text-gray-500">
              {format(new Date(today), 'yyyy년 MM월 dd일 (eee)', { locale: ko })}
            </p>
          </div>
        </div>
        <button onClick={handlePrint} className="btn-primary flex items-center gap-2">
          <Printer size={16} />
          인쇄 / PDF 저장
        </button>
      </div>

      {/* 자동 생성 보고문 */}
      <div className="card">
        <div className="card-header">
          <h3 className="font-semibold text-gray-800">자동 생성 보고 문구</h3>
        </div>
        <div className="card-body">
          <div className="bg-gray-50 rounded-lg p-4 text-sm text-gray-700 leading-relaxed whitespace-pre-line border border-gray-200">
            {reportText}
          </div>
        </div>
      </div>

      {/* 전체 실적 요약 */}
      <div className="card">
        <div className="card-header">
          <h3 className="font-semibold text-gray-800">전체 실적 요약</h3>
        </div>
        <div className="card-body">
          <div className="grid grid-cols-3 gap-4">
            {[
              { label: '전체 계획', value: `${formatNumber(summary.total_plan)} KG`, color: 'text-gray-700' },
              { label: '전체 실적', value: `${formatNumber(summary.total_actual)} KG`, color: 'text-blue-700' },
              {
                label: '전체 달성율', value: `${summary.total_achievement_rate.toFixed(1)}%`,
                color: summary.total_achievement_rate >= 100 ? 'text-green-600' :
                  summary.total_achievement_rate >= 90 ? 'text-yellow-600' : 'text-red-600'
              },
            ].map(item => (
              <div key={item.label} className="text-center py-4 bg-gray-50 rounded-lg">
                <div className="text-xs text-gray-500 mb-1">{item.label}</div>
                <div className={`text-xl font-bold ${item.color}`}>{item.value}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* 설비별 실적 */}
      <div className="card">
        <div className="card-header">
          <h3 className="font-semibold text-gray-800">설비별 목표 대비 실적</h3>
        </div>
        <div className="table-wrapper">
          <table className="production-table">
            <thead>
              <tr>
                <th>설비</th>
                <th>근무조</th>
                <th>제품 계획</th>
                <th>제품 실적</th>
                <th>제품 달성율</th>
                <th>제품 미달량</th>
                <th>황지 계획</th>
                <th>황지 실적</th>
                <th>황지 달성율</th>
                <th>황지 미달량</th>
                <th>주요 사유</th>
              </tr>
            </thead>
            <tbody>
              {entries.map(entry => {
                const pRate = entry.product_plan > 0 ? (entry.product_actual / entry.product_plan * 100) : null;
                const bRate = entry.billet_plan > 0 ? (entry.billet_actual / entry.billet_plan * 100) : null;
                const pShortfall = Math.max(0, (entry.product_plan || 0) - (entry.product_actual || 0));
                const bShortfall = Math.max(0, (entry.billet_plan || 0) - (entry.billet_actual || 0));

                return (
                  <tr key={entry.id}>
                    <td className="text-center-cell font-bold">{entry.equipment}</td>
                    <td className="text-center-cell">{entry.shift}</td>
                    <td>{formatNumber(entry.product_plan)}</td>
                    <td className="font-medium">{formatNumber(entry.product_actual)}</td>
                    <td className={`text-center-cell font-semibold ${
                      pRate === null ? 'text-gray-400' :
                        pRate >= 100 ? 'text-green-600' : pRate >= 90 ? 'text-yellow-600' : 'text-red-600'
                    }`}>
                      {pRate !== null ? `${pRate.toFixed(1)}%` : '-'}
                    </td>
                    <td className={pShortfall > 0 ? 'text-red-600' : 'text-gray-400'}>
                      {pShortfall > 0 ? formatNumber(pShortfall) : '-'}
                    </td>
                    <td>{formatNumber(entry.billet_plan)}</td>
                    <td className="font-medium">{formatNumber(entry.billet_actual)}</td>
                    <td className={`text-center-cell font-semibold ${
                      bRate === null ? 'text-gray-400' :
                        bRate >= 100 ? 'text-green-600' : bRate >= 90 ? 'text-yellow-600' : 'text-red-600'
                    }`}>
                      {bRate !== null ? `${bRate.toFixed(1)}%` : '-'}
                    </td>
                    <td className={bShortfall > 0 ? 'text-red-600' : 'text-gray-400'}>
                      {bShortfall > 0 ? formatNumber(bShortfall) : '-'}
                    </td>
                    <td className="text-center-cell text-xs">
                      {entry.reason_category || <span className="text-gray-300">-</span>}
                    </td>
                  </tr>
                );
              })}
              {/* 합계 행 */}
              <tr className="bg-blue-50 font-bold border-t-2 border-blue-200">
                <td colSpan={2} className="text-center-cell">합 계</td>
                <td>{formatNumber(summary.total_product_plan)}</td>
                <td>{formatNumber(summary.total_product_actual)}</td>
                <td className={`text-center-cell ${
                  summary.product_achievement_rate >= 100 ? 'text-green-600' :
                    summary.product_achievement_rate >= 90 ? 'text-yellow-600' : 'text-red-600'
                }`}>
                  {summary.product_achievement_rate.toFixed(1)}%
                </td>
                <td className="text-red-600">
                  {summary.total_product_plan - summary.total_product_actual > 0
                    ? formatNumber(summary.total_product_plan - summary.total_product_actual) : '-'}
                </td>
                <td>{formatNumber(summary.total_billet_plan)}</td>
                <td>{formatNumber(summary.total_billet_actual)}</td>
                <td className={`text-center-cell ${
                  summary.billet_achievement_rate >= 100 ? 'text-green-600' :
                    summary.billet_achievement_rate >= 90 ? 'text-yellow-600' : 'text-red-600'
                }`}>
                  {summary.billet_achievement_rate.toFixed(1)}%
                </td>
                <td className="text-red-600">
                  {summary.total_billet_plan - summary.total_billet_actual > 0
                    ? formatNumber(summary.total_billet_plan - summary.total_billet_actual) : '-'}
                </td>
                <td></td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* 미달성 사유 및 만회대책 */}
      {entries.some(e => e.reason_category) && (
        <div className="card">
          <div className="card-header">
            <h3 className="font-semibold text-gray-800">미달성 사유 및 만회대책</h3>
          </div>
          <div className="card-body">
            <table className="w-full text-sm border border-gray-200 rounded-lg overflow-hidden">
              <thead>
                <tr className="bg-gray-100">
                  <th className="px-3 py-2 text-left border-b border-gray-200">설비/근무조</th>
                  <th className="px-3 py-2 text-left border-b border-gray-200">사유</th>
                  <th className="px-3 py-2 text-left border-b border-gray-200">상세 원인</th>
                  <th className="px-3 py-2 text-left border-b border-gray-200">금일 조치</th>
                  <th className="px-3 py-2 text-left border-b border-gray-200">만회계획</th>
                </tr>
              </thead>
              <tbody>
                {entries
                  .filter(e => e.reason_category)
                  .map(entry => (
                    <tr key={entry.id} className="border-b border-gray-100">
                      <td className="px-3 py-2 font-medium whitespace-nowrap">
                        {entry.equipment} / {entry.shift}
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap text-orange-700">
                        {entry.reason_category}
                      </td>
                      <td className="px-3 py-2 text-gray-600 max-w-xs">
                        {entry.reason_detail || '-'}
                      </td>
                      <td className="px-3 py-2 text-gray-600 max-w-xs">
                        {entry.action_today || '-'}
                      </td>
                      <td className="px-3 py-2 text-gray-600 max-w-xs">
                        {entry.recovery_plan || '-'}
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
