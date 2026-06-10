import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';
import { Download, Printer, ArrowLeft } from 'lucide-react';
import { useReportStore } from '../store/reportStore';
import { calcDashboardSummary, formatNumber } from '../utils/calculations';
import { generateOverallSummary, generateReasonSentence } from '../utils/reportTextGenerator';
import { getEquipmentReasonGroups } from '../utils/reasonGroups';
import ReasonContent, { ReasonTextList } from '../components/ReasonContent';
import type { Equipment, Shift } from '../types';
import {
  getActualDateFromPlanDate,
  getPlanDateFromActualDate,
  getTodayPlanDate,
} from '../utils/reportDates';
import { downloadReportExcel } from '../utils/excelTemplate';

function calcNullableRate(actual: number, plan: number) {
  return plan > 0 ? (actual / plan) * 100 : null;
}

function getPrintRateClass(rate: number | null) {
  if (rate === null) return 'text-gray-400';
  if (rate >= 100) return 'text-green-700';
  if (rate >= 90) return 'text-yellow-700';
  return 'text-red-700';
}

const PRINT_EQUIPMENT_ORDER: Equipment[] = ['P15', 'P5', 'R/M', 'P8'];
const PRINT_SHIFT_ORDER: Shift[] = ['주간', '야간'];

function getOrderIndex<T>(order: readonly T[], value: T) {
  const index = order.indexOf(value);
  return index === -1 ? order.length : index;
}

export default function PrintReportPage() {
  const { reportDate } = useParams<{ reportDate: string }>();
  const navigate = useNavigate();
  const { reports, getEntriesByReport } = useReportStore();

  const actualDate = reportDate || getActualDateFromPlanDate(getTodayPlanDate());
  const planDate = getPlanDateFromActualDate(actualDate);
  const report = reports.find(r => r.report_date === actualDate);
  const reportPlanDate = report?.next_plan_date || planDate;
  const entries = report ? getEntriesByReport(report.id) : [];
  const summary = calcDashboardSummary(entries);
  const equipmentGroups = PRINT_EQUIPMENT_ORDER.map(equipment => {
    const rows = entries
      .filter(entry => entry.equipment === equipment)
      .sort((a, b) => getOrderIndex(PRINT_SHIFT_ORDER, a.shift) - getOrderIndex(PRINT_SHIFT_ORDER, b.shift))
      .map(entry => {
        const productShortfall = Math.max(0, (entry.product_plan || 0) - (entry.product_actual || 0));
        const billetShortfall = Math.max(0, (entry.billet_plan || 0) - (entry.billet_actual || 0));

        return {
          entry,
          productRate: calcNullableRate(entry.product_actual, entry.product_plan),
          billetRate: calcNullableRate(entry.billet_actual, entry.billet_plan),
          productShortfall,
          billetShortfall,
          hasShortfall: productShortfall > 0 || billetShortfall > 0,
        };
      });
    const productPlan = rows.reduce((sum, row) => sum + (row.entry.product_plan || 0), 0);
    const productActual = rows.reduce((sum, row) => sum + (row.entry.product_actual || 0), 0);
    const billetPlan = rows.reduce((sum, row) => sum + (row.entry.billet_plan || 0), 0);
    const billetActual = rows.reduce((sum, row) => sum + (row.entry.billet_actual || 0), 0);
    const nextProductPlan = rows.reduce((sum, row) => sum + (row.entry.next_product_plan || 0), 0);
    const nextBilletPlan = rows.reduce((sum, row) => sum + (row.entry.next_billet_plan || 0), 0);

    return {
      equipment,
      rows,
      total: {
        productPlan,
        productActual,
        productRate: calcNullableRate(productActual, productPlan),
        productShortfall: Math.max(0, productPlan - productActual),
        billetPlan,
        billetActual,
        billetRate: calcNullableRate(billetActual, billetPlan),
        billetShortfall: Math.max(0, billetPlan - billetActual),
        nextProductPlan,
        nextBilletPlan,
      },
    };
  }).filter(group => group.rows.length > 0);
  const reasonGroups = getEquipmentReasonGroups(entries);
  const reasonGroupsByEquipment = new Map(reasonGroups.map(group => [group.equipment, group]));

  const handlePrint = () => window.print();
  const handleExcelDownload = async () => {
    if (!report) return;

    try {
      await downloadReportExcel(report, entries);
    } catch {
      window.alert('엑셀 보고서 파일을 다운로드할 수 없습니다.');
    }
  };

  if (!report) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-400">
        보고서를 찾을 수 없습니다.
      </div>
    );
  }

  const formattedActualDate = format(new Date(actualDate), 'yyyy년 MM월 dd일 (eee)', { locale: ko });
  const formattedPlanDate = format(new Date(reportPlanDate), 'yyyy년 MM월 dd일 (eee)', { locale: ko });
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
          인쇄 미리보기 — 전일 실적 {formattedActualDate} / 금일 계획 {formattedPlanDate}
        </div>
        <div className="ml-auto flex gap-2">
          <button
            onClick={handleExcelDownload}
            className="btn-secondary flex items-center gap-2"
          >
            <Download size={16} />
            엑셀 다운로드
          </button>
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
        <div className="print-sheet max-w-4xl mx-auto">
          {/* 보고서 헤더 */}
          <div className="print-header text-center mb-6 pb-4 border-b-2 border-blue-800">
            <h1 className="text-2xl font-bold text-blue-900">단조 생산 일일 보고서</h1>
            <div className="flex justify-between items-center mt-2 text-sm text-gray-600">
              <span>전일 실적일: {formattedActualDate}</span>
              <span>금일 계획일: {formattedPlanDate}</span>
              <span>출력일시: {format(new Date(), 'yyyy.MM.dd HH:mm')}</span>
            </div>
          </div>

          {/* 1. 종합 요약 */}
          <div className="print-section mb-5">
            <div className="print-section-title bg-blue-100 px-3 py-2 font-bold text-blue-900 text-sm mb-2 border-l-4 border-blue-700">
              1. 전일 실적 및 금일 계획 요약
            </div>
            <div className="print-kpi-grid grid grid-cols-4 gap-3 mb-3">
              <div className={`print-kpi-card p-3 rounded-lg text-center border-2 ${
                summary.total_achievement_rate >= 100 ? 'bg-green-50 border-green-300' :
                  summary.total_achievement_rate >= 90 ? 'bg-yellow-50 border-yellow-300' : 'bg-red-50 border-red-300'
              }`}>
                <div className="text-xs text-gray-500">전체 달성율</div>
                <div className={`print-kpi-value text-2xl font-bold mt-1 ${
                  summary.total_achievement_rate >= 100 ? 'text-green-700' :
                    summary.total_achievement_rate >= 90 ? 'text-yellow-700' : 'text-red-700'
                }`}>
                  {summary.total_achievement_rate.toFixed(1)}%
                </div>
                <div className="text-xs text-gray-500 mt-0.5">
                  {formatNumber(summary.total_actual)} / {formatNumber(summary.total_plan)} KG
                </div>
              </div>
              <div className="print-kpi-card p-3 rounded-lg text-center border bg-blue-50 border-blue-200">
                <div className="text-xs text-gray-500">제품 달성율</div>
                <div className="print-kpi-value text-2xl font-bold mt-1 text-blue-700">
                  {summary.product_achievement_rate.toFixed(1)}%
                </div>
                <div className="text-xs text-gray-500 mt-0.5">
                  {formatNumber(summary.total_product_actual)} / {formatNumber(summary.total_product_plan)} KG
                </div>
              </div>
              <div className="print-kpi-card p-3 rounded-lg text-center border bg-amber-50 border-amber-200">
                <div className="text-xs text-gray-500">황지 달성율</div>
                <div className="print-kpi-value text-2xl font-bold mt-1 text-amber-700">
                  {summary.billet_achievement_rate.toFixed(1)}%
                </div>
                <div className="text-xs text-gray-500 mt-0.5">
                  {formatNumber(summary.total_billet_actual)} / {formatNumber(summary.total_billet_plan)} KG
                </div>
              </div>
              <div className="print-kpi-card p-3 rounded-lg text-center border bg-green-50 border-green-200">
                <div className="text-xs text-gray-500">금일 계획</div>
                <div className="print-kpi-value text-2xl font-bold mt-1 text-green-700">
                  {formatNumber(summary.total_next_plan)}
                </div>
                <div className="text-xs text-gray-500 mt-0.5">
                  제품 {formatNumber(summary.total_next_product_plan)} / 황지 {formatNumber(summary.total_next_billet_plan)} KG
                </div>
              </div>
            </div>
            <div className="print-summary-box p-3 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-700 leading-relaxed">
              {overallSummary}
            </div>
          </div>

          {/* 2. 설비별 실적 표 */}
          <div className="print-section mb-5">
            <div className="print-section-title bg-blue-100 px-3 py-2 font-bold text-blue-900 text-sm mb-2 border-l-4 border-blue-700">
              2. 전일 생산실적 보고 (단위: KG)
            </div>
            <table className="print-table print-table-actual w-full text-xs">
              <thead>
                <tr>
                  <th rowSpan={2} className="bg-blue-800 text-white px-2 py-1.5 text-center border border-gray-400">설비</th>
                  <th rowSpan={2} className="bg-blue-800 text-white px-2 py-1.5 text-center border border-gray-400">근무조</th>
                  <th colSpan={4} className="bg-blue-600 text-white px-2 py-1.5 text-center border border-gray-400">제품 (KG)</th>
                  <th colSpan={4} className="bg-blue-600 text-white px-2 py-1.5 text-center border border-gray-400">황지 (KG)</th>
                  <th rowSpan={2} className="bg-blue-800 text-white px-2 py-1.5 text-center border border-gray-400">미달 사유</th>
                </tr>
                <tr>
                  <th className="bg-blue-700 text-white px-2 py-1 text-center border border-gray-400">전일계획</th>
                  <th className="bg-blue-700 text-white px-2 py-1 text-center border border-gray-400">실적</th>
                  <th className="bg-blue-700 text-white px-2 py-1 text-center border border-gray-400">달성율</th>
                  <th className="bg-blue-700 text-white px-2 py-1 text-center border border-gray-400">미달량</th>
                  <th className="bg-blue-700 text-white px-2 py-1 text-center border border-gray-400">전일계획</th>
                  <th className="bg-blue-700 text-white px-2 py-1 text-center border border-gray-400">실적</th>
                  <th className="bg-blue-700 text-white px-2 py-1 text-center border border-gray-400">달성율</th>
                  <th className="bg-blue-700 text-white px-2 py-1 text-center border border-gray-400">미달량</th>
                </tr>
              </thead>
              <tbody>
                {equipmentGroups.map(group => {
                  const reasonGroup = reasonGroupsByEquipment.get(group.equipment);
                  const reasonLabel = reasonGroup?.categories.join(', ');

                  return (
                  <React.Fragment key={group.equipment}>
                    {group.rows.map((row, rowIndex) => (
                      <tr
                        key={row.entry.id}
                        style={row.hasShortfall && row.entry.product_actual > 0 ? { backgroundColor: '#fff7ed' } : {}}
                      >
                        <td className="px-2 py-1.5 text-center font-bold border border-gray-300">{row.entry.equipment}</td>
                        <td className="px-2 py-1.5 text-center border border-gray-300">{row.entry.shift}</td>
                        <td className="px-2 py-1.5 text-right border border-gray-300">{formatNumber(row.entry.product_plan)}</td>
                        <td className="px-2 py-1.5 text-right font-medium border border-gray-300">{formatNumber(row.entry.product_actual)}</td>
                        <td className={`px-2 py-1.5 text-center font-bold border border-gray-300 ${getPrintRateClass(row.productRate)}`}>
                          {row.productRate !== null ? `${row.productRate.toFixed(1)}%` : '-'}
                        </td>
                        <td className={`px-2 py-1.5 text-right border border-gray-300 ${row.productShortfall > 0 ? 'text-red-700 font-medium' : 'text-gray-300'}`}>
                          {row.productShortfall > 0 ? formatNumber(row.productShortfall) : '-'}
                        </td>
                        <td className="px-2 py-1.5 text-right border border-gray-300">{formatNumber(row.entry.billet_plan)}</td>
                        <td className="px-2 py-1.5 text-right font-medium border border-gray-300">{formatNumber(row.entry.billet_actual)}</td>
                        <td className={`px-2 py-1.5 text-center font-bold border border-gray-300 ${getPrintRateClass(row.billetRate)}`}>
                          {row.billetRate !== null ? `${row.billetRate.toFixed(1)}%` : '-'}
                        </td>
                        <td className={`px-2 py-1.5 text-right border border-gray-300 ${row.billetShortfall > 0 ? 'text-red-700 font-medium' : 'text-gray-300'}`}>
                          {row.billetShortfall > 0 ? formatNumber(row.billetShortfall) : '-'}
                        </td>
                        {rowIndex === 0 && (
                          <td rowSpan={group.rows.length + 1} className="px-2 py-1.5 text-center text-xs border border-gray-300 align-middle">
                            {reasonLabel || '-'}
                          </td>
                        )}
                      </tr>
                    ))}
                    <tr style={{ backgroundColor: '#f8fafc', fontWeight: 'bold' }}>
                      <td colSpan={2} className="px-2 py-1.5 text-center border border-gray-300">{group.equipment} 합계</td>
                      <td className="px-2 py-1.5 text-right border border-gray-300">{formatNumber(group.total.productPlan)}</td>
                      <td className="px-2 py-1.5 text-right border border-gray-300">{formatNumber(group.total.productActual)}</td>
                      <td className={`px-2 py-1.5 text-center border border-gray-300 ${getPrintRateClass(group.total.productRate)}`}>
                        {group.total.productRate !== null ? `${group.total.productRate.toFixed(1)}%` : '-'}
                      </td>
                      <td className={`px-2 py-1.5 text-right border border-gray-300 ${group.total.productShortfall > 0 ? 'text-red-700 font-medium' : 'text-gray-300'}`}>
                        {group.total.productShortfall > 0 ? formatNumber(group.total.productShortfall) : '-'}
                      </td>
                      <td className="px-2 py-1.5 text-right border border-gray-300">{formatNumber(group.total.billetPlan)}</td>
                      <td className="px-2 py-1.5 text-right border border-gray-300">{formatNumber(group.total.billetActual)}</td>
                      <td className={`px-2 py-1.5 text-center border border-gray-300 ${getPrintRateClass(group.total.billetRate)}`}>
                        {group.total.billetRate !== null ? `${group.total.billetRate.toFixed(1)}%` : '-'}
                      </td>
                      <td className={`px-2 py-1.5 text-right border border-gray-300 ${group.total.billetShortfall > 0 ? 'text-red-700 font-medium' : 'text-gray-300'}`}>
                        {group.total.billetShortfall > 0 ? formatNumber(group.total.billetShortfall) : '-'}
                      </td>
                    </tr>
                  </React.Fragment>
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
          {reasonGroups.length > 0 && (
            <div className="print-section mb-5">
              <div className="print-section-title bg-blue-100 px-3 py-2 font-bold text-blue-900 text-sm mb-2 border-l-4 border-blue-700">
                3. 미달성 사유 및 만회대책
              </div>
              <table className="print-table print-table-reasons w-full text-xs">
                <thead>
                  <tr>
                    <th className="bg-blue-800 text-white px-2 py-1.5 text-center border border-gray-400 w-20">설비</th>
                    <th className="bg-blue-800 text-white px-2 py-1.5 text-center border border-gray-400 w-20">미달 사유</th>
                    <th className="bg-blue-800 text-white px-2 py-1.5 text-center border border-gray-400">내용</th>
                  </tr>
                </thead>
                <tbody>
                  {reasonGroups.map(group => (
                      <tr key={group.equipment}>
                        <td className="px-2 py-2 text-center font-bold border border-gray-300">
                          {group.equipment}
                        </td>
                        <td className="px-2 py-2 text-center border border-gray-300 text-orange-700 font-medium">
                          {group.categories.join(', ') || '-'}
                        </td>
                        <td className="px-2 py-2 border border-gray-300 leading-relaxed">
                          <ReasonContent group={group} labelClassName="font-bold" />
                        </td>
                      </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* 4. 금일 생산계획 */}
          <div className="print-section mb-5">
            <div className="print-section-title bg-blue-100 px-3 py-2 font-bold text-blue-900 text-sm mb-2 border-l-4 border-blue-700">
              4. 금일 생산계획 보고 (단위: KG, 계획일: {formattedPlanDate})
            </div>
            <table className="print-table print-table-plan w-full text-xs">
              <thead>
                <tr>
                  <th rowSpan={2} className="bg-blue-800 text-white px-2 py-1.5 text-center border border-gray-400">설비</th>
                  <th rowSpan={2} className="bg-blue-800 text-white px-2 py-1.5 text-center border border-gray-400">근무조</th>
                  <th colSpan={4} className="bg-blue-600 text-white px-2 py-1.5 text-center border border-gray-400">제품 (KG)</th>
                  <th colSpan={4} className="bg-blue-600 text-white px-2 py-1.5 text-center border border-gray-400">황지 (KG)</th>
                  <th rowSpan={2} className="bg-blue-800 text-white px-2 py-1.5 text-center border border-gray-400">만회계획</th>
                </tr>
                <tr>
                  <th className="bg-blue-700 text-white px-2 py-1 text-center border border-gray-400">전일계획</th>
                  <th className="bg-blue-700 text-white px-2 py-1 text-center border border-gray-400">전일실적</th>
                  <th className="bg-blue-700 text-white px-2 py-1 text-center border border-gray-400">미달량</th>
                  <th className="bg-blue-700 text-white px-2 py-1 text-center border border-gray-400">금일계획</th>
                  <th className="bg-blue-700 text-white px-2 py-1 text-center border border-gray-400">전일계획</th>
                  <th className="bg-blue-700 text-white px-2 py-1 text-center border border-gray-400">전일실적</th>
                  <th className="bg-blue-700 text-white px-2 py-1 text-center border border-gray-400">미달량</th>
                  <th className="bg-blue-700 text-white px-2 py-1 text-center border border-gray-400">금일계획</th>
                </tr>
              </thead>
              <tbody>
                {equipmentGroups.map(group => {
                  const recoveryPlans = reasonGroupsByEquipment.get(group.equipment)?.recoveryPlans ?? [];

                  return (
                    <React.Fragment key={group.equipment}>
                      {group.rows.map((row, rowIndex) => {
                        const entry = row.entry;
                        const nextProductPlan = entry.next_product_plan || 0;
                        const nextBilletPlan = entry.next_billet_plan || 0;

                        return (
                          <tr key={entry.id}>
                            <td className="px-2 py-1.5 text-center font-bold border border-gray-300">{entry.equipment}</td>
                            <td className="px-2 py-1.5 text-center border border-gray-300">{entry.shift}</td>
                            <td className="px-2 py-1.5 text-right border border-gray-300">{formatNumber(entry.product_plan)}</td>
                            <td className="px-2 py-1.5 text-right font-medium border border-gray-300">{formatNumber(entry.product_actual)}</td>
                            <td className={`px-2 py-1.5 text-right border border-gray-300 ${row.productShortfall > 0 ? 'text-red-700 font-medium' : 'text-gray-300'}`}>
                              {row.productShortfall > 0 ? formatNumber(row.productShortfall) : '-'}
                            </td>
                            <td className="px-2 py-1.5 text-right border border-gray-300 font-medium">{formatNumber(nextProductPlan)}</td>
                            <td className="px-2 py-1.5 text-right border border-gray-300">{formatNumber(entry.billet_plan)}</td>
                            <td className="px-2 py-1.5 text-right font-medium border border-gray-300">{formatNumber(entry.billet_actual)}</td>
                            <td className={`px-2 py-1.5 text-right border border-gray-300 ${row.billetShortfall > 0 ? 'text-red-700 font-medium' : 'text-gray-300'}`}>
                              {row.billetShortfall > 0 ? formatNumber(row.billetShortfall) : '-'}
                            </td>
                            <td className="px-2 py-1.5 text-right border border-gray-300 font-medium">{formatNumber(nextBilletPlan)}</td>
                            {rowIndex === 0 && (
                              <td rowSpan={group.rows.length + 1} className="px-2 py-1.5 text-left border border-gray-300 text-gray-500 align-middle">
                                <ReasonTextList values={recoveryPlans} fallback="-" />
                              </td>
                            )}
                          </tr>
                        );
                      })}
                      <tr style={{ backgroundColor: '#f8fafc', fontWeight: 'bold' }}>
                        <td colSpan={2} className="px-2 py-1.5 text-center border border-gray-300">{group.equipment} 합계</td>
                        <td className="px-2 py-1.5 text-right border border-gray-300">{formatNumber(group.total.productPlan)}</td>
                        <td className="px-2 py-1.5 text-right border border-gray-300">{formatNumber(group.total.productActual)}</td>
                        <td className={`px-2 py-1.5 text-right border border-gray-300 ${group.total.productShortfall > 0 ? 'text-red-700 font-medium' : 'text-gray-300'}`}>
                          {group.total.productShortfall > 0 ? formatNumber(group.total.productShortfall) : '-'}
                        </td>
                        <td className="px-2 py-1.5 text-right border border-gray-300">{formatNumber(group.total.nextProductPlan)}</td>
                        <td className="px-2 py-1.5 text-right border border-gray-300">{formatNumber(group.total.billetPlan)}</td>
                        <td className="px-2 py-1.5 text-right border border-gray-300">{formatNumber(group.total.billetActual)}</td>
                        <td className={`px-2 py-1.5 text-right border border-gray-300 ${group.total.billetShortfall > 0 ? 'text-red-700 font-medium' : 'text-gray-300'}`}>
                          {group.total.billetShortfall > 0 ? formatNumber(group.total.billetShortfall) : '-'}
                        </td>
                        <td className="px-2 py-1.5 text-right border border-gray-300">{formatNumber(group.total.nextBilletPlan)}</td>
                      </tr>
                    </React.Fragment>
                  );
                })}
                <tr style={{ backgroundColor: '#dbeafe', fontWeight: 'bold' }}>
                  <td colSpan={2} className="px-2 py-1.5 text-center border border-gray-400">합 계</td>
                  <td className="px-2 py-1.5 text-right border border-gray-400">{formatNumber(summary.total_product_plan)}</td>
                  <td className="px-2 py-1.5 text-right border border-gray-400">{formatNumber(summary.total_product_actual)}</td>
                  <td className="px-2 py-1.5 text-right text-red-700 border border-gray-400">
                    {summary.total_product_plan - summary.total_product_actual > 0
                      ? formatNumber(summary.total_product_plan - summary.total_product_actual) : '-'}
                  </td>
                  <td className="px-2 py-1.5 text-right border border-gray-400">{formatNumber(summary.total_next_product_plan)}</td>
                  <td className="px-2 py-1.5 text-right border border-gray-400">{formatNumber(summary.total_billet_plan)}</td>
                  <td className="px-2 py-1.5 text-right border border-gray-400">{formatNumber(summary.total_billet_actual)}</td>
                  <td className="px-2 py-1.5 text-right text-red-700 border border-gray-400">
                    {summary.total_billet_plan - summary.total_billet_actual > 0
                      ? formatNumber(summary.total_billet_plan - summary.total_billet_actual) : '-'}
                  </td>
                  <td className="px-2 py-1.5 text-right border border-gray-400">{formatNumber(summary.total_next_billet_plan)}</td>
                  <td className="border border-gray-400"></td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* 5. 종합 의견 */}
          <div className="print-section mb-5">
            <div className="print-section-title bg-blue-100 px-3 py-2 font-bold text-blue-900 text-sm mb-2 border-l-4 border-blue-700">
              5. 종합 의견
            </div>
            <div className="print-opinion border border-gray-300 rounded-lg p-4 text-sm text-gray-700 leading-relaxed min-h-[80px] bg-white">
              {overallSummary}
              {summary.total_shortfall > 0 && (
                <div className="mt-2 text-red-700">
                  ※ 총 미달량 {formatNumber(summary.total_shortfall)} KG — 금일 계획에 만회분 반영 검토 요망
                </div>
              )}
            </div>
          </div>

        </div>
      </div>
    </>
  );
}
