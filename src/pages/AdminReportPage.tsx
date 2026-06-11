import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';
import { ArrowLeft, Download, Printer } from 'lucide-react';
import { useReportStore } from '../store/reportStore';
import { calcDashboardSummary, formatNumber } from '../utils/calculations';
import { generateReportText } from '../utils/reportTextGenerator';
import { getEquipmentReasonGroups } from '../utils/reasonGroups';
import ReasonContent, { ReasonTextList } from '../components/ReasonContent';
import { EQUIPMENT_LIST, SHIFT_LIST } from '../types';
import {
  getActualDateFromPlanDate,
  getPlanDateFromActualDate,
  getTodayPlanDate,
} from '../utils/reportDates';
import { downloadReportExcel } from '../utils/excelTemplate';

function calcNullableRate(actual: number, target: number) {
  return target > 0 ? (actual / target) * 100 : null;
}

function getRateClass(rate: number | null) {
  if (rate === null) return 'text-gray-400';
  if (rate >= 100) return 'text-green-600';
  if (rate >= 90) return 'text-yellow-600';
  return 'text-red-600';
}

export default function AdminReportPage() {
  const { reportDate } = useParams<{ reportDate: string }>();
  const navigate = useNavigate();
  const { reports, getEntriesByReport, targets } = useReportStore();

  const actualDate = reportDate || getActualDateFromPlanDate(getTodayPlanDate());
  const planDate = getPlanDateFromActualDate(actualDate);
  const report = reports.find(r => r.report_date === actualDate);
  const reportPlanDate = report?.next_plan_date || planDate;
  const entries = report ? getEntriesByReport(report.id) : [];
  const summary = calcDashboardSummary(entries);
  const dailyTargetSummary = targets.reduce(
    (acc, target) => ({
      product: acc.product + (target.product_target || 0),
      billet: acc.billet + (target.billet_target || 0),
    }),
    { product: 0, billet: 0 }
  );
  const targetSummary = {
    productRate: calcNullableRate(summary.total_product_actual, dailyTargetSummary.product) ?? 0,
    billetRate: calcNullableRate(summary.total_billet_actual, dailyTargetSummary.billet) ?? 0,
    totalRate: calcNullableRate(
      summary.total_product_actual + summary.total_billet_actual,
      dailyTargetSummary.product + dailyTargetSummary.billet
    ) ?? 0,
    productShortfall: Math.max(0, dailyTargetSummary.product - summary.total_product_actual),
    billetShortfall: Math.max(0, dailyTargetSummary.billet - summary.total_billet_actual),
  };
  const targetBasedSummary = {
    ...summary,
    total_product_plan: dailyTargetSummary.product,
    total_billet_plan: dailyTargetSummary.billet,
    total_plan: dailyTargetSummary.product + dailyTargetSummary.billet,
    total_achievement_rate: targetSummary.totalRate,
    product_achievement_rate: targetSummary.productRate,
    billet_achievement_rate: targetSummary.billetRate,
    total_shortfall: targetSummary.productShortfall + targetSummary.billetShortfall,
  };
  const reportText = report ? generateReportText(targetBasedSummary, entries, actualDate) : '';
  const equipmentGroups = EQUIPMENT_LIST.map(equipment => {
    const equipmentTargets = targets.filter(target => target.equipment === equipment);
    const rows = entries
      .filter(entry => entry.equipment === equipment)
      .sort((a, b) => SHIFT_LIST.indexOf(a.shift) - SHIFT_LIST.indexOf(b.shift))
      .map(entry => {
        const shiftTarget = equipmentTargets.find(target => target.shift === entry.shift);
        const productShortfall = Math.max(0, (entry.product_plan || 0) - (entry.product_actual || 0));
        const billetShortfall = Math.max(0, (entry.billet_plan || 0) - (entry.billet_actual || 0));

        return {
          entry,
          productRate: calcNullableRate(entry.product_actual, shiftTarget?.product_target || 0),
          billetRate: calcNullableRate(entry.billet_actual, shiftTarget?.billet_target || 0),
          productShortfall,
          billetShortfall,
        };
      });
    const productPlan = rows.reduce((sum, row) => sum + (row.entry.product_plan || 0), 0);
    const productActual = rows.reduce((sum, row) => sum + (row.entry.product_actual || 0), 0);
    const billetPlan = rows.reduce((sum, row) => sum + (row.entry.billet_plan || 0), 0);
    const billetActual = rows.reduce((sum, row) => sum + (row.entry.billet_actual || 0), 0);
    const nextProductPlan = rows.reduce((sum, row) => sum + (row.entry.next_product_plan || 0), 0);
    const nextBilletPlan = rows.reduce((sum, row) => sum + (row.entry.next_billet_plan || 0), 0);
    const productTarget = equipmentTargets.reduce((sum, target) => sum + (target.product_target || 0), 0);
    const billetTarget = equipmentTargets.reduce((sum, target) => sum + (target.billet_target || 0), 0);

    return {
      equipment,
      rows,
      total: {
        productPlan,
        productActual,
        productRate: calcNullableRate(productActual, productTarget),
        productShortfall: Math.max(0, productPlan - productActual),
        billetPlan,
        billetActual,
        billetRate: calcNullableRate(billetActual, billetTarget),
        billetShortfall: Math.max(0, billetPlan - billetActual),
        nextProductPlan,
        nextBilletPlan,
      },
    };
  }).filter(group => group.rows.length > 0);
  const reasonGroups = getEquipmentReasonGroups(entries);
  const reasonGroupsByEquipment = new Map(reasonGroups.map(group => [group.equipment, group]));
  const summaryItems = [
    {
      label: '제품',
      plan: targetBasedSummary.total_product_plan,
      actual: summary.total_product_actual,
      rate: targetBasedSummary.product_achievement_rate,
      shortfall: targetSummary.productShortfall,
      panelClass: 'border-blue-200 bg-blue-50',
      labelClass: 'text-blue-800',
    },
    {
      label: '황지',
      plan: targetBasedSummary.total_billet_plan,
      actual: summary.total_billet_actual,
      rate: targetBasedSummary.billet_achievement_rate,
      shortfall: targetSummary.billetShortfall,
      panelClass: 'border-amber-200 bg-amber-50',
      labelClass: 'text-amber-800',
    },
  ];

  const handlePrint = () => navigate(`/reports/${actualDate}/print`);
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
              전일 실적일 {format(new Date(actualDate), 'yyyy년 MM월 dd일 (eee)', { locale: ko })} ·
              금일 계획일 {format(new Date(reportPlanDate), 'yyyy년 MM월 dd일 (eee)', { locale: ko })}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={handleExcelDownload} className="btn-secondary flex items-center gap-2">
            <Download size={16} />
            엑셀 다운로드
          </button>
          <button onClick={handlePrint} className="btn-primary flex items-center gap-2">
            <Printer size={16} />
            인쇄 / PDF 저장
          </button>
        </div>
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
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {summaryItems.map(item => (
              <div key={item.label} className={`rounded-lg border p-4 ${item.panelClass}`}>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className={`text-sm font-bold ${item.labelClass}`}>{item.label}</div>
                    <div className="text-xs text-gray-500 mt-0.5">일일 목표 대비 실적</div>
                  </div>
                  <div className={`text-2xl font-bold ${
                    item.rate >= 100 ? 'text-green-700' :
                      item.rate >= 90 ? 'text-yellow-700' : 'text-red-700'
                  }`}>
                    {item.rate.toFixed(1)}%
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-3 mt-4 text-sm">
                  <div>
                    <div className="text-xs text-gray-500">일일 목표</div>
                    <div className="font-semibold text-gray-800">{formatNumber(item.plan)} KG</div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-500">실적</div>
                    <div className="font-semibold text-gray-800">{formatNumber(item.actual)} KG</div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-500">미달량</div>
                    <div className={`font-semibold ${item.shortfall > 0 ? 'text-red-700' : 'text-gray-500'}`}>
                      {item.shortfall > 0 ? `${formatNumber(item.shortfall)} KG` : '-'}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* 설비별 실적 */}
      <div className="card">
        <div className="card-header">
          <h3 className="font-semibold text-gray-800">전일 계획 대비 실적</h3>
        </div>
        <div className="table-wrapper">
          <table className="production-table">
            <thead>
              <tr>
                <th>설비</th>
                <th>근무조</th>
                <th>전일 제품 계획</th>
                <th>제품 실적</th>
                <th>제품 목표달성율</th>
                <th>제품 미달량</th>
                <th>전일 황지 계획</th>
                <th>황지 실적</th>
                <th>황지 목표달성율</th>
                <th>황지 미달량</th>
                <th>주요 사유</th>
              </tr>
            </thead>
            <tbody>
              {equipmentGroups.map(group => {
                const reasonGroup = reasonGroupsByEquipment.get(group.equipment);
                const reasonLabel = reasonGroup?.categories.join(', ');

                return (
                <React.Fragment key={group.equipment}>
                  {group.rows.map((row, rowIndex) => (
                    <tr key={row.entry.id}>
                      <td className="text-center-cell font-bold">{row.entry.equipment}</td>
                      <td className="text-center-cell">{row.entry.shift}</td>
                      <td>{formatNumber(row.entry.product_plan)}</td>
                      <td className="font-medium">{formatNumber(row.entry.product_actual)}</td>
                      <td className={`text-center-cell font-semibold ${getRateClass(row.productRate)}`}>
                        {row.productRate !== null ? `${row.productRate.toFixed(1)}%` : '-'}
                      </td>
                      <td className={row.productShortfall > 0 ? 'text-red-600' : 'text-gray-400'}>
                        {row.productShortfall > 0 ? formatNumber(row.productShortfall) : '-'}
                      </td>
                      <td>{formatNumber(row.entry.billet_plan)}</td>
                      <td className="font-medium">{formatNumber(row.entry.billet_actual)}</td>
                      <td className={`text-center-cell font-semibold ${getRateClass(row.billetRate)}`}>
                        {row.billetRate !== null ? `${row.billetRate.toFixed(1)}%` : '-'}
                      </td>
                      <td className={row.billetShortfall > 0 ? 'text-red-600' : 'text-gray-400'}>
                        {row.billetShortfall > 0 ? formatNumber(row.billetShortfall) : '-'}
                      </td>
                      {rowIndex === 0 && (
                        <td rowSpan={group.rows.length + 1} className="text-center-cell text-xs align-middle">
                          {reasonLabel || <span className="text-gray-300">-</span>}
                        </td>
                      )}
                    </tr>
                  ))}
                  <tr className="bg-slate-50 font-semibold border-t border-slate-200">
                    <td colSpan={2} className="text-center-cell">{group.equipment} 합계</td>
                    <td>{formatNumber(group.total.productPlan)}</td>
                    <td>{formatNumber(group.total.productActual)}</td>
                    <td className={`text-center-cell ${getRateClass(group.total.productRate)}`}>
                      {group.total.productRate !== null ? `${group.total.productRate.toFixed(1)}%` : '-'}
                    </td>
                    <td className={group.total.productShortfall > 0 ? 'text-red-600' : 'text-gray-400'}>
                      {group.total.productShortfall > 0 ? formatNumber(group.total.productShortfall) : '-'}
                    </td>
                    <td>{formatNumber(group.total.billetPlan)}</td>
                    <td>{formatNumber(group.total.billetActual)}</td>
                    <td className={`text-center-cell ${getRateClass(group.total.billetRate)}`}>
                      {group.total.billetRate !== null ? `${group.total.billetRate.toFixed(1)}%` : '-'}
                    </td>
                    <td className={group.total.billetShortfall > 0 ? 'text-red-600' : 'text-gray-400'}>
                      {group.total.billetShortfall > 0 ? formatNumber(group.total.billetShortfall) : '-'}
                    </td>
                  </tr>
                </React.Fragment>
                );
              })}
              {/* 합계 행 */}
              <tr className="bg-blue-50 font-bold border-t-2 border-blue-200">
                <td colSpan={2} className="text-center-cell">합 계</td>
                <td>{formatNumber(summary.total_product_plan)}</td>
                <td>{formatNumber(summary.total_product_actual)}</td>
                <td className={`text-center-cell ${
                  targetBasedSummary.product_achievement_rate >= 100 ? 'text-green-600' :
                    targetBasedSummary.product_achievement_rate >= 90 ? 'text-yellow-600' : 'text-red-600'
                }`}>
                  {targetBasedSummary.product_achievement_rate.toFixed(1)}%
                </td>
                <td className="text-red-600">
                  {summary.total_product_plan - summary.total_product_actual > 0
                    ? formatNumber(summary.total_product_plan - summary.total_product_actual) : '-'}
                </td>
                <td>{formatNumber(summary.total_billet_plan)}</td>
                <td>{formatNumber(summary.total_billet_actual)}</td>
                <td className={`text-center-cell ${
                  targetBasedSummary.billet_achievement_rate >= 100 ? 'text-green-600' :
                    targetBasedSummary.billet_achievement_rate >= 90 ? 'text-yellow-600' : 'text-red-600'
                }`}>
                  {targetBasedSummary.billet_achievement_rate.toFixed(1)}%
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

      {/* 금일 생산계획 */}
      <div className="card">
        <div className="card-header">
          <h3 className="font-semibold text-gray-800">금일 생산계획</h3>
        </div>
        <div className="table-wrapper">
          <table className="production-table">
            <thead>
              <tr>
                <th>설비</th>
                <th>근무조</th>
                <th>전일 제품 계획</th>
                <th>제품 실적</th>
                <th>제품 미달량</th>
                <th>금일 제품 계획</th>
                <th>전일 황지 계획</th>
                <th>황지 실적</th>
                <th>황지 미달량</th>
                <th>금일 황지 계획</th>
                <th>만회계획</th>
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
                          <td className="text-center-cell font-bold">{entry.equipment}</td>
                          <td className="text-center-cell">{entry.shift}</td>
                          <td>{formatNumber(entry.product_plan)}</td>
                          <td className="font-medium">{formatNumber(entry.product_actual)}</td>
                          <td className={row.productShortfall > 0 ? 'text-red-600' : 'text-gray-400'}>
                            {row.productShortfall > 0 ? formatNumber(row.productShortfall) : '-'}
                          </td>
                          <td className="font-medium">{formatNumber(nextProductPlan)}</td>
                          <td>{formatNumber(entry.billet_plan)}</td>
                          <td className="font-medium">{formatNumber(entry.billet_actual)}</td>
                          <td className={row.billetShortfall > 0 ? 'text-red-600' : 'text-gray-400'}>
                            {row.billetShortfall > 0 ? formatNumber(row.billetShortfall) : '-'}
                          </td>
                          <td className="font-medium">{formatNumber(nextBilletPlan)}</td>
                          {rowIndex === 0 && (
                            <td rowSpan={group.rows.length + 1} className="text-left text-xs align-middle">
                              <ReasonTextList values={recoveryPlans} fallback="-" />
                            </td>
                          )}
                        </tr>
                      );
                    })}
                    <tr className="bg-slate-50 font-semibold border-t border-slate-200">
                      <td colSpan={2} className="text-center-cell">{group.equipment} 합계</td>
                      <td>{formatNumber(group.total.productPlan)}</td>
                      <td>{formatNumber(group.total.productActual)}</td>
                      <td className={group.total.productShortfall > 0 ? 'text-red-600' : 'text-gray-400'}>
                        {group.total.productShortfall > 0 ? formatNumber(group.total.productShortfall) : '-'}
                      </td>
                      <td>{formatNumber(group.total.nextProductPlan)}</td>
                      <td>{formatNumber(group.total.billetPlan)}</td>
                      <td>{formatNumber(group.total.billetActual)}</td>
                      <td className={group.total.billetShortfall > 0 ? 'text-red-600' : 'text-gray-400'}>
                        {group.total.billetShortfall > 0 ? formatNumber(group.total.billetShortfall) : '-'}
                      </td>
                      <td>{formatNumber(group.total.nextBilletPlan)}</td>
                    </tr>
                  </React.Fragment>
                );
              })}
              <tr className="bg-green-50 font-bold border-t-2 border-green-200">
                <td colSpan={2} className="text-center-cell">합 계</td>
                <td>{formatNumber(summary.total_product_plan)}</td>
                <td>{formatNumber(summary.total_product_actual)}</td>
                <td className="text-red-600">
                  {summary.total_product_plan - summary.total_product_actual > 0
                    ? formatNumber(summary.total_product_plan - summary.total_product_actual) : '-'}
                </td>
                <td>{formatNumber(summary.total_next_product_plan)}</td>
                <td>{formatNumber(summary.total_billet_plan)}</td>
                <td>{formatNumber(summary.total_billet_actual)}</td>
                <td className="text-red-600">
                  {summary.total_billet_plan - summary.total_billet_actual > 0
                    ? formatNumber(summary.total_billet_plan - summary.total_billet_actual) : '-'}
                </td>
                <td>{formatNumber(summary.total_next_billet_plan)}</td>
                <td></td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* 미달성 사유 및 만회대책 */}
      {reasonGroups.length > 0 && (
        <div className="card">
          <div className="card-header">
            <h3 className="font-semibold text-gray-800">미달성 사유 및 만회대책</h3>
          </div>
          <div className="card-body">
            <table className="w-full text-sm border border-gray-200 rounded-lg overflow-hidden">
              <thead>
                <tr className="bg-gray-100">
                  <th className="px-3 py-2 text-left border-b border-gray-200">설비</th>
                  <th className="px-3 py-2 text-left border-b border-gray-200">사유</th>
                  <th className="px-3 py-2 text-left border-b border-gray-200">내용</th>
                </tr>
              </thead>
              <tbody>
                {reasonGroups.map(group => (
                  <tr key={group.equipment} className="border-b border-gray-100">
                    <td className="px-3 py-2 font-medium whitespace-nowrap">
                      {group.equipment}
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap text-orange-700">
                      {group.categories.join(', ') || '-'}
                    </td>
                    <td className="px-3 py-2 text-gray-600 leading-relaxed">
                      <ReasonContent group={group} />
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
