import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';
import { Printer, ArrowLeft } from 'lucide-react';
import { useReportStore } from '../store/reportStore';
import { calcDashboardSummary, formatNumber } from '../utils/calculations';
import { generateOverallSummary, generateReasonSentence } from '../utils/reportTextGenerator';

export default function PrintReportPage() {
  const { reportDate } = useParams<{ reportDate: string }>();
  const navigate = useNavigate();
  const { reports, getEntriesByReport } = useReportStore();

  const today = reportDate || format(new Date(), 'yyyy-MM-dd');
  const report = reports.find(r => r.report_date === today);
  const entries = report ? getEntriesByReport(report.id) : [];
  const summary = calcDashboardSummary(entries);

  const handlePrint = () => window.print();

  if (!report) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-400">
        보고서를 찾을 수 없습니다.
      </div>
    );
  }

  const formattedDate = format(new Date(today), 'yyyy년 MM월 dd일 (eee)', { locale: ko });
  const overallSummary = generateOverallSummary(summary);

  return (
    <>
      {/* 화면용 버튼 (인쇄 시 숨김) */}
      <div className="no-print fixed top-0 left-0 right-0 z-50 bg-white border-b border-gray-200 px-6 py-3 flex items-center gap-3 shadow-sm">
        <button onClick={() => navigate(-1)} className="btn-secondary flex items-center gap-2 text-sm">
          <ArrowLeft size={16} />
          뒤로가기
        </button>
        <div className="text-sm font-medium text-gray-700">
          인쇄 미리보기 — {formattedDate}
        </div>
        <div className="ml-auto flex gap-2">
          <button
            onClick={handlePrint}
            className="btn-primary flex items-center gap-2"
          >
            <Printer size={16} />
            인쇄 / PDF 저장
          </button>
        </div>
      </div>

      {/* 인쇄 콘텐츠 */}
      <div className="print-area bg-white min-h-screen p-8 pt-20 no-print:pt-20">
        <div className="max-w-4xl mx-auto">
          {/* 보고서 헤더 */}
          <div className="print-header text-center mb-6 pb-4 border-b-2 border-blue-800">
            <h1 className="text-2xl font-bold text-blue-900">단조 생산 일일 보고서</h1>
            <div className="flex justify-between items-center mt-2 text-sm text-gray-600">
              <span>보고일자: {formattedDate}</span>
              <span>익일계획일: {format(new Date(report.next_plan_date), 'yyyy년 MM월 dd일', { locale: ko })}</span>
              <span>출력일시: {format(new Date(), 'yyyy.MM.dd HH:mm')}</span>
            </div>
          </div>

          {/* 1. 종합 요약 */}
          <div className="mb-5">
            <div className="print-section-title bg-blue-100 px-3 py-2 font-bold text-blue-900 text-sm mb-2 border-l-4 border-blue-700">
              1. 종합 실적 요약
            </div>
            <div className="grid grid-cols-3 gap-3 mb-3">
              <div className={`p-3 rounded-lg text-center border-2 ${
                summary.total_achievement_rate >= 100 ? 'bg-green-50 border-green-300' :
                  summary.total_achievement_rate >= 90 ? 'bg-yellow-50 border-yellow-300' : 'bg-red-50 border-red-300'
              }`}>
                <div className="text-xs text-gray-500">전체 달성율</div>
                <div className={`text-2xl font-bold mt-1 ${
                  summary.total_achievement_rate >= 100 ? 'text-green-700' :
                    summary.total_achievement_rate >= 90 ? 'text-yellow-700' : 'text-red-700'
                }`}>
                  {summary.total_achievement_rate.toFixed(1)}%
                </div>
                <div className="text-xs text-gray-500 mt-0.5">
                  {formatNumber(summary.total_actual)} / {formatNumber(summary.total_plan)} KG
                </div>
              </div>
              <div className="p-3 rounded-lg text-center border bg-blue-50 border-blue-200">
                <div className="text-xs text-gray-500">제품 달성율</div>
                <div className="text-2xl font-bold mt-1 text-blue-700">
                  {summary.product_achievement_rate.toFixed(1)}%
                </div>
                <div className="text-xs text-gray-500 mt-0.5">
                  {formatNumber(summary.total_product_actual)} / {formatNumber(summary.total_product_plan)} KG
                </div>
              </div>
              <div className="p-3 rounded-lg text-center border bg-amber-50 border-amber-200">
                <div className="text-xs text-gray-500">황지 달성율</div>
                <div className="text-2xl font-bold mt-1 text-amber-700">
                  {summary.billet_achievement_rate.toFixed(1)}%
                </div>
                <div className="text-xs text-gray-500 mt-0.5">
                  {formatNumber(summary.total_billet_actual)} / {formatNumber(summary.total_billet_plan)} KG
                </div>
              </div>
            </div>
            <div className="p-3 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-700 leading-relaxed">
              {overallSummary}
            </div>
          </div>

          {/* 2. 설비별 실적 표 */}
          <div className="mb-5">
            <div className="print-section-title bg-blue-100 px-3 py-2 font-bold text-blue-900 text-sm mb-2 border-l-4 border-blue-700">
              2. 전일 생산실적 보고 (단위: KG)
            </div>
            <table className="print-table w-full text-xs">
              <thead>
                <tr>
                  <th rowSpan={2} className="bg-blue-800 text-white px-2 py-1.5 text-center border border-gray-400">설비</th>
                  <th rowSpan={2} className="bg-blue-800 text-white px-2 py-1.5 text-center border border-gray-400">근무조</th>
                  <th colSpan={4} className="bg-blue-600 text-white px-2 py-1.5 text-center border border-gray-400">제품 (KG)</th>
                  <th colSpan={4} className="bg-blue-600 text-white px-2 py-1.5 text-center border border-gray-400">황지 (KG)</th>
                  <th rowSpan={2} className="bg-blue-800 text-white px-2 py-1.5 text-center border border-gray-400">미달 사유</th>
                </tr>
                <tr>
                  <th className="bg-blue-700 text-white px-2 py-1 text-center border border-gray-400">계획</th>
                  <th className="bg-blue-700 text-white px-2 py-1 text-center border border-gray-400">실적</th>
                  <th className="bg-blue-700 text-white px-2 py-1 text-center border border-gray-400">달성율</th>
                  <th className="bg-blue-700 text-white px-2 py-1 text-center border border-gray-400">미달량</th>
                  <th className="bg-blue-700 text-white px-2 py-1 text-center border border-gray-400">계획</th>
                  <th className="bg-blue-700 text-white px-2 py-1 text-center border border-gray-400">실적</th>
                  <th className="bg-blue-700 text-white px-2 py-1 text-center border border-gray-400">달성율</th>
                  <th className="bg-blue-700 text-white px-2 py-1 text-center border border-gray-400">미달량</th>
                </tr>
              </thead>
              <tbody>
                {entries.map(entry => {
                  const pRate = entry.product_plan > 0 ? (entry.product_actual / entry.product_plan * 100) : null;
                  const bRate = entry.billet_plan > 0 ? (entry.billet_actual / entry.billet_plan * 100) : null;
                  const pShortfall = Math.max(0, (entry.product_plan || 0) - (entry.product_actual || 0));
                  const bShortfall = Math.max(0, (entry.billet_plan || 0) - (entry.billet_actual || 0));
                  const hasShortfall = pShortfall > 0 || bShortfall > 0;

                  return (
                    <tr key={entry.id} style={hasShortfall && entry.product_actual > 0 ? { backgroundColor: '#fff7ed' } : {}}>
                      <td className="px-2 py-1.5 text-center font-bold border border-gray-300">{entry.equipment}</td>
                      <td className="px-2 py-1.5 text-center border border-gray-300">{entry.shift}</td>
                      <td className="px-2 py-1.5 text-right border border-gray-300">{formatNumber(entry.product_plan)}</td>
                      <td className="px-2 py-1.5 text-right font-medium border border-gray-300">{formatNumber(entry.product_actual)}</td>
                      <td className={`px-2 py-1.5 text-center font-bold border border-gray-300 ${
                        pRate === null ? 'text-gray-400' :
                          pRate >= 100 ? 'text-green-700' : pRate >= 90 ? 'text-yellow-700' : 'text-red-700'
                      }`}>
                        {pRate !== null ? `${pRate.toFixed(1)}%` : '-'}
                      </td>
                      <td className={`px-2 py-1.5 text-right border border-gray-300 ${pShortfall > 0 ? 'text-red-700 font-medium' : 'text-gray-300'}`}>
                        {pShortfall > 0 ? formatNumber(pShortfall) : '-'}
                      </td>
                      <td className="px-2 py-1.5 text-right border border-gray-300">{formatNumber(entry.billet_plan)}</td>
                      <td className="px-2 py-1.5 text-right font-medium border border-gray-300">{formatNumber(entry.billet_actual)}</td>
                      <td className={`px-2 py-1.5 text-center font-bold border border-gray-300 ${
                        bRate === null ? 'text-gray-400' :
                          bRate >= 100 ? 'text-green-700' : bRate >= 90 ? 'text-yellow-700' : 'text-red-700'
                      }`}>
                        {bRate !== null ? `${bRate.toFixed(1)}%` : '-'}
                      </td>
                      <td className={`px-2 py-1.5 text-right border border-gray-300 ${bShortfall > 0 ? 'text-red-700 font-medium' : 'text-gray-300'}`}>
                        {bShortfall > 0 ? formatNumber(bShortfall) : '-'}
                      </td>
                      <td className="px-2 py-1.5 text-center text-xs border border-gray-300">
                        {entry.reason_category || '-'}
                      </td>
                    </tr>
                  );
                })}
                {/* 합계 행 */}
                <tr style={{ backgroundColor: '#dbeafe', fontWeight: 'bold', borderTop: '2px solid #1d4ed8' }}>
                  <td colSpan={2} className="px-2 py-1.5 text-center border border-gray-400">합 계</td>
                  <td className="px-2 py-1.5 text-right border border-gray-400">{formatNumber(summary.total_product_plan)}</td>
                  <td className="px-2 py-1.5 text-right border border-gray-400">{formatNumber(summary.total_product_actual)}</td>
                  <td className={`px-2 py-1.5 text-center border border-gray-400 ${
                    summary.product_achievement_rate >= 100 ? 'text-green-700' :
                      summary.product_achievement_rate >= 90 ? 'text-yellow-700' : 'text-red-700'
                  }`}>
                    {summary.product_achievement_rate.toFixed(1)}%
                  </td>
                  <td className="px-2 py-1.5 text-right text-red-700 border border-gray-400">
                    {summary.total_product_plan - summary.total_product_actual > 0
                      ? formatNumber(summary.total_product_plan - summary.total_product_actual) : '-'}
                  </td>
                  <td className="px-2 py-1.5 text-right border border-gray-400">{formatNumber(summary.total_billet_plan)}</td>
                  <td className="px-2 py-1.5 text-right border border-gray-400">{formatNumber(summary.total_billet_actual)}</td>
                  <td className={`px-2 py-1.5 text-center border border-gray-400 ${
                    summary.billet_achievement_rate >= 100 ? 'text-green-700' :
                      summary.billet_achievement_rate >= 90 ? 'text-yellow-700' : 'text-red-700'
                  }`}>
                    {summary.billet_achievement_rate.toFixed(1)}%
                  </td>
                  <td className="px-2 py-1.5 text-right text-red-700 border border-gray-400">
                    {summary.total_billet_plan - summary.total_billet_actual > 0
                      ? formatNumber(summary.total_billet_plan - summary.total_billet_actual) : '-'}
                  </td>
                  <td className="border border-gray-400"></td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* 3. 미달성 사유 및 만회대책 */}
          {entries.some(e => e.reason_category) && (
            <div className="mb-5">
              <div className="print-section-title bg-blue-100 px-3 py-2 font-bold text-blue-900 text-sm mb-2 border-l-4 border-blue-700">
                3. 미달성 사유 및 만회대책
              </div>
              <table className="print-table w-full text-xs">
                <thead>
                  <tr>
                    <th className="bg-blue-800 text-white px-2 py-1.5 text-center border border-gray-400 w-20">설비/조</th>
                    <th className="bg-blue-800 text-white px-2 py-1.5 text-center border border-gray-400 w-20">미달 사유</th>
                    <th className="bg-blue-800 text-white px-2 py-1.5 text-center border border-gray-400">상세 원인</th>
                    <th className="bg-blue-800 text-white px-2 py-1.5 text-center border border-gray-400">금일 조치사항</th>
                    <th className="bg-blue-800 text-white px-2 py-1.5 text-center border border-gray-400">익일 만회계획</th>
                  </tr>
                </thead>
                <tbody>
                  {entries
                    .filter(e => e.reason_category)
                    .map(entry => (
                      <tr key={entry.id}>
                        <td className="px-2 py-2 text-center font-bold border border-gray-300">
                          {entry.equipment}<br/>{entry.shift}
                        </td>
                        <td className="px-2 py-2 text-center border border-gray-300 text-orange-700 font-medium">
                          {entry.reason_category}
                        </td>
                        <td className="px-2 py-2 border border-gray-300 leading-relaxed">
                          {entry.reason_detail || '-'}
                        </td>
                        <td className="px-2 py-2 border border-gray-300 leading-relaxed">
                          {entry.action_today || '-'}
                        </td>
                        <td className="px-2 py-2 border border-gray-300 leading-relaxed">
                          {entry.recovery_plan || '-'}
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          )}

          {/* 4. 익일 생산계획 */}
          <div className="mb-5">
            <div className="print-section-title bg-blue-100 px-3 py-2 font-bold text-blue-900 text-sm mb-2 border-l-4 border-blue-700">
              4. 일일 생산계획 보고 (익일: {format(new Date(report.next_plan_date), 'yyyy년 MM월 dd일', { locale: ko })})
            </div>
            <table className="print-table w-full text-xs">
              <thead>
                <tr>
                  <th className="bg-blue-800 text-white px-2 py-1.5 text-center border border-gray-400">설비</th>
                  <th className="bg-blue-800 text-white px-2 py-1.5 text-center border border-gray-400">근무조</th>
                  <th className="bg-blue-800 text-white px-2 py-1.5 text-center border border-gray-400">제품 계획 (KG)</th>
                  <th className="bg-blue-800 text-white px-2 py-1.5 text-center border border-gray-400">황지 계획 (KG)</th>
                  <th className="bg-blue-800 text-white px-2 py-1.5 text-center border border-gray-400">만회계획 포함량</th>
                  <th className="bg-blue-800 text-white px-2 py-1.5 text-center border border-gray-400">비고</th>
                </tr>
              </thead>
              <tbody>
                {entries.map(entry => {
                  const pShortfall = Math.max(0, (entry.product_plan || 0) - (entry.product_actual || 0));
                  return (
                    <tr key={entry.id}>
                      <td className="px-2 py-1.5 text-center font-bold border border-gray-300">{entry.equipment}</td>
                      <td className="px-2 py-1.5 text-center border border-gray-300">{entry.shift}</td>
                      <td className="px-2 py-1.5 text-right border border-gray-300">{formatNumber(entry.product_plan)}</td>
                      <td className="px-2 py-1.5 text-right border border-gray-300">{formatNumber(entry.billet_plan)}</td>
                      <td className={`px-2 py-1.5 text-right border border-gray-300 ${pShortfall > 0 ? 'text-red-700 font-medium' : ''}`}>
                        {pShortfall > 0 ? `+${formatNumber(pShortfall)}` : '-'}
                      </td>
                      <td className="px-2 py-1.5 text-center border border-gray-300 text-gray-500">
                        {entry.recovery_plan ? '만회계획 포함' : '-'}
                      </td>
                    </tr>
                  );
                })}
                <tr style={{ backgroundColor: '#dbeafe', fontWeight: 'bold' }}>
                  <td colSpan={2} className="px-2 py-1.5 text-center border border-gray-400">합 계</td>
                  <td className="px-2 py-1.5 text-right border border-gray-400">{formatNumber(summary.total_product_plan)}</td>
                  <td className="px-2 py-1.5 text-right border border-gray-400">{formatNumber(summary.total_billet_plan)}</td>
                  <td className="px-2 py-1.5 text-right text-red-700 border border-gray-400">
                    {summary.total_shortfall > 0 ? `+${formatNumber(summary.total_shortfall)}` : '-'}
                  </td>
                  <td className="border border-gray-400"></td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* 5. 종합 의견 */}
          <div className="mb-5">
            <div className="print-section-title bg-blue-100 px-3 py-2 font-bold text-blue-900 text-sm mb-2 border-l-4 border-blue-700">
              5. 종합 의견
            </div>
            <div className="border border-gray-300 rounded-lg p-4 text-sm text-gray-700 leading-relaxed min-h-[80px] bg-white">
              {overallSummary}
              {summary.total_shortfall > 0 && (
                <div className="mt-2 text-red-700">
                  ※ 총 미달량 {formatNumber(summary.total_shortfall)} KG — 익일 계획에 만회분 반영 요망
                </div>
              )}
            </div>
          </div>

          {/* 서명란 */}
          <div className="flex justify-end gap-4 mt-6">
            {['작 성', '검 토', '승 인'].map(label => (
              <div key={label} className="text-center border border-gray-400 rounded w-24">
                <div className="text-xs font-medium bg-gray-100 py-1 border-b border-gray-300">{label}</div>
                <div className="h-10"></div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}
