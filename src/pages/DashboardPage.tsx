import React from 'react';
import { useNavigate } from 'react-router-dom';
import {
  endOfMonth,
  endOfWeek,
  endOfYear,
  format,
  isWithinInterval,
  parseISO,
  startOfMonth,
  startOfWeek,
  startOfYear,
} from 'date-fns';
import { ko } from 'date-fns/locale';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Cell,
} from 'recharts';
import {
  AlertTriangle, CalendarRange, CheckCircle, Clock,
  Printer, PlusCircle, RefreshCw, Users,
} from 'lucide-react';
import { useReportStore } from '../store/reportStore';
import { calcDashboardSummary, formatNumber } from '../utils/calculations';
import KPIStatusCard from '../components/KPIStatusCard';
import SubmitStatusBadge from '../components/SubmitStatusBadge';
import { EQUIPMENT_LIST, PeriodTargetType, SHIFT_LIST } from '../types';

type SummaryPeriod = 'day' | 'week' | 'month' | 'year';

const PERIOD_OPTIONS: { value: SummaryPeriod; label: string }[] = [
  { value: 'day', label: '일간' },
  { value: 'week', label: '주간' },
  { value: 'month', label: '월간' },
  { value: 'year', label: '연간' },
];

const PERIOD_TARGET_MAP: Partial<Record<SummaryPeriod, PeriodTargetType>> = {
  week: 'weekly',
  month: 'monthly',
  year: 'yearly',
};

function getPeriodRange(dateString: string, period: SummaryPeriod) {
  const baseDate = parseISO(dateString);

  switch (period) {
    case 'week':
      return {
        start: startOfWeek(baseDate, { weekStartsOn: 1 }),
        end: endOfWeek(baseDate, { weekStartsOn: 1 }),
      };
    case 'month':
      return {
        start: startOfMonth(baseDate),
        end: endOfMonth(baseDate),
      };
    case 'year':
      return {
        start: startOfYear(baseDate),
        end: endOfYear(baseDate),
      };
    default:
      return { start: baseDate, end: baseDate };
  }
}

function formatPeriodRange(range: { start: Date; end: Date }, period: SummaryPeriod) {
  if (period === 'day') {
    return format(range.start, 'yyyy년 MM월 dd일 (eee)', { locale: ko });
  }
  if (period === 'month') {
    return format(range.start, 'yyyy년 MM월', { locale: ko });
  }
  if (period === 'year') {
    return format(range.start, 'yyyy년', { locale: ko });
  }
  return `${format(range.start, 'yyyy년 MM월 dd일', { locale: ko })} - ${format(range.end, 'MM월 dd일', { locale: ko })}`;
}

function getRateColor(rate: number) {
  if (rate >= 100) return 'text-green-700';
  if (rate >= 90) return 'text-yellow-700';
  return 'text-red-700';
}

function calcRate(actual: number, plan: number) {
  return plan > 0 ? Math.round((actual / plan) * 1000) / 10 : 0;
}

export default function DashboardPage() {
  const navigate = useNavigate();
  const { reports, targets, periodTargets, getEntriesByReport, createReport, getCurrentUser } = useReportStore();
  const currentUser = getCurrentUser();
  const isAdmin = currentUser?.role === 'admin';
  const canWrite = isAdmin || Boolean(currentUser?.can_write);
  const canEdit = isAdmin || Boolean(currentUser?.can_edit);
  const canCreateReport = canWrite || canEdit;
  const [selectedDate, setSelectedDate] = React.useState(format(new Date(), 'yyyy-MM-dd'));
  const [selectedPeriod, setSelectedPeriod] = React.useState<SummaryPeriod>('day');

  const report = reports.find(r => r.report_date === selectedDate);
  const periodRange = React.useMemo(
    () => getPeriodRange(selectedDate, selectedPeriod),
    [selectedDate, selectedPeriod]
  );
  const periodReports = React.useMemo(
    () => reports
      .filter(r => isWithinInterval(parseISO(r.report_date), periodRange))
      .sort((a, b) => new Date(a.report_date).getTime() - new Date(b.report_date).getTime()),
    [reports, periodRange]
  );
  const reportDateById = React.useMemo(
    () => new Map(reports.map(r => [r.id, r.report_date])),
    [reports]
  );
  const entries = React.useMemo(() => {
    if (selectedPeriod === 'day') {
      return report ? getEntriesByReport(report.id) : [];
    }

    return periodReports.flatMap(periodReport => getEntriesByReport(periodReport.id));
  }, [selectedPeriod, report, periodReports, getEntriesByReport]);
  const summary = calcDashboardSummary(entries);
  const dailyTargetSummary = React.useMemo(() => {
    return targets.reduce(
      (acc, target) => ({
        product: acc.product + (target.product_target || 0),
        billet: acc.billet + (target.billet_target || 0),
      }),
      { product: 0, billet: 0 }
    );
  }, [targets]);
  const targetByEquipmentShift = React.useMemo(() => {
    return new Map(
      targets.map(target => [
        `${target.equipment}-${target.shift}`,
        {
          product: target.product_target || 0,
          billet: target.billet_target || 0,
        },
      ])
    );
  }, [targets]);
  const hasPeriodData = selectedPeriod === 'day' ? Boolean(report) : periodReports.length > 0;
  const periodLabel = PERIOD_OPTIONS.find(option => option.value === selectedPeriod)?.label ?? '일간';
  const periodRangeLabel = formatPeriodRange(periodRange, selectedPeriod);
  const selectedPeriodTarget = PERIOD_TARGET_MAP[selectedPeriod]
    ? periodTargets.find(target => target.period === PERIOD_TARGET_MAP[selectedPeriod])
    : undefined;
  const usesConfiguredPeriodTarget = selectedPeriod !== 'day' &&
    Boolean(selectedPeriodTarget && (selectedPeriodTarget.product_target > 0 || selectedPeriodTarget.billet_target > 0));
  const summaryProductPlan = selectedPeriod === 'day'
    ? dailyTargetSummary.product
    : usesConfiguredPeriodTarget ? selectedPeriodTarget!.product_target : summary.total_product_plan;
  const summaryBilletPlan = selectedPeriod === 'day'
    ? dailyTargetSummary.billet
    : usesConfiguredPeriodTarget ? selectedPeriodTarget!.billet_target : summary.total_billet_plan;
  const summaryProductRate = summaryProductPlan > 0
    ? Math.round((summary.total_product_actual / summaryProductPlan) * 1000) / 10
    : 0;
  const summaryBilletRate = summaryBilletPlan > 0
    ? Math.round((summary.total_billet_actual / summaryBilletPlan) * 1000) / 10
    : 0;
  const productShortfall = Math.max(0, summaryProductPlan - summary.total_product_actual);
  const billetShortfall = Math.max(0, summaryBilletPlan - summary.total_billet_actual);
  const detailProductPlan = selectedPeriod === 'day' ? summaryProductPlan : summary.total_product_plan;
  const detailBilletPlan = selectedPeriod === 'day' ? summaryBilletPlan : summary.total_billet_plan;
  const detailProductRate = selectedPeriod === 'day' ? summaryProductRate : summary.product_achievement_rate;
  const detailBilletRate = selectedPeriod === 'day' ? summaryBilletRate : summary.billet_achievement_rate;
  const detailProductShortfall = Math.max(0, detailProductPlan - summary.total_product_actual);
  const detailBilletShortfall = Math.max(0, detailBilletPlan - summary.total_billet_actual);
  const productPlanLabel = selectedPeriod === 'day' ? '제품 목표' : '제품 계획';
  const billetPlanLabel = selectedPeriod === 'day' ? '황지 목표' : '황지 계획';
  const equipmentSummaries = React.useMemo(() => {
    if (selectedPeriod !== 'day') return summary.by_equipment;

    return EQUIPMENT_LIST.map(equipment => {
      const base = summary.by_equipment.find(item => item.equipment === equipment);
      const equipmentTargets = targets.filter(target => target.equipment === equipment);
      const productPlan = equipmentTargets.reduce((sum, target) => sum + (target.product_target || 0), 0);
      const billetPlan = equipmentTargets.reduce((sum, target) => sum + (target.billet_target || 0), 0);
      const productActual = base?.product_actual || 0;
      const billetActual = base?.billet_actual || 0;

      return {
        equipment,
        product_plan: productPlan,
        product_actual: productActual,
        billet_plan: billetPlan,
        billet_actual: billetActual,
        product_achievement_rate: calcRate(productActual, productPlan),
        billet_achievement_rate: calcRate(billetActual, billetPlan),
      };
    });
  }, [selectedPeriod, summary.by_equipment, targets]);
  const shiftSummaries = React.useMemo(() => {
    if (selectedPeriod !== 'day') return summary.by_shift;

    return SHIFT_LIST.map(shift => {
      const base = summary.by_shift.find(item => item.shift === shift);
      const shiftTargets = targets.filter(target => target.shift === shift);
      const productPlan = shiftTargets.reduce((sum, target) => sum + (target.product_target || 0), 0);
      const billetPlan = shiftTargets.reduce((sum, target) => sum + (target.billet_target || 0), 0);
      const productActual = base?.product_actual || 0;
      const billetActual = base?.billet_actual || 0;

      return {
        shift,
        product_plan: productPlan,
        product_actual: productActual,
        billet_plan: billetPlan,
        billet_actual: billetActual,
        product_achievement_rate: calcRate(productActual, productPlan),
        billet_achievement_rate: calcRate(billetActual, billetPlan),
      };
    });
  }, [selectedPeriod, summary.by_shift, targets]);
  const summaryCards = [
    {
      label: '제품',
      plan: summaryProductPlan,
      actual: summary.total_product_actual,
      rate: summaryProductRate,
      shortfall: productShortfall,
      panelClass: 'border-blue-200 bg-blue-50',
      labelClass: 'text-blue-800',
    },
    {
      label: '황지',
      plan: summaryBilletPlan,
      actual: summary.total_billet_actual,
      rate: summaryBilletRate,
      shortfall: billetShortfall,
      panelClass: 'border-amber-200 bg-amber-50',
      labelClass: 'text-amber-800',
    },
  ];

  const handleCreateReport = () => {
    if (!canCreateReport) return;
    createReport(selectedDate);
  };

  const handleGoInput = () => {
    navigate(`/reports/${selectedDate}/input`);
  };

  const handlePrint = () => {
    navigate(`/reports/${selectedDate}/print`);
  };

  // 차트용 데이터
  const equipmentChartData = equipmentSummaries.map(eq => ({
    name: eq.equipment,
    [productPlanLabel]: eq.product_plan,
    '제품 실적': eq.product_actual,
    [billetPlanLabel]: eq.billet_plan,
    '황지 실적': eq.billet_actual,
  }));

  const achievementChartData = equipmentSummaries.map(eq => ({
    name: eq.equipment,
    '제품 달성율': eq.product_achievement_rate,
    '황지 달성율': eq.billet_achievement_rate,
  }));

  const shiftChartData = shiftSummaries.map(s => ({
    name: s.shift,
    [productPlanLabel]: s.product_plan,
    '제품 실적': s.product_actual,
    [billetPlanLabel]: s.billet_plan,
    '황지 실적': s.billet_actual,
  }));

  return (
    <div className="space-y-6 fade-in">
      {/* 페이지 헤더 */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">생산 대시보드</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {periodLabel} · {periodRangeLabel} 기준
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <div className="inline-flex rounded-lg border border-gray-200 bg-white p-1">
            {PERIOD_OPTIONS.map(option => (
              <button
                key={option.value}
                type="button"
                onClick={() => setSelectedPeriod(option.value)}
                className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                  selectedPeriod === option.value
                    ? 'bg-blue-600 text-white'
                    : 'text-gray-600 hover:bg-gray-50'
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>
          <input
            type="date"
            value={selectedDate}
            onChange={e => setSelectedDate(e.target.value)}
            className="form-input w-auto"
          />
          {selectedPeriod !== 'day' && (
            <button onClick={() => navigate('/reports')} className="btn-secondary flex items-center gap-2">
              <CalendarRange size={16} />
              보고 이력
            </button>
          )}
          {selectedPeriod === 'day' && !report ? (
            <button
              onClick={handleCreateReport}
              disabled={!canCreateReport}
              className="btn-primary flex items-center gap-2"
            >
              <PlusCircle size={16} />
              보고서 생성
            </button>
          ) : selectedPeriod === 'day' ? (
            <>
              <button onClick={handleGoInput} className="btn-secondary flex items-center gap-2">
                <RefreshCw size={16} />
                실적 입력
              </button>
              <button onClick={handlePrint} className="btn-primary flex items-center gap-2">
                <Printer size={16} />
                보고서 출력
              </button>
            </>
          ) : null}
        </div>
      </div>

      {!hasPeriodData ? (
        <div className="card">
          <div className="card-body text-center py-12">
            <AlertTriangle className="mx-auto mb-3 text-yellow-400" size={40} />
            <p className="text-gray-600">
              {selectedPeriod === 'day' ? '해당 날짜의 보고서가 없습니다.' : '선택 기간의 보고서가 없습니다.'}
            </p>
            {selectedPeriod === 'day' && (
              <button onClick={handleCreateReport} disabled={!canCreateReport} className="btn-primary mt-4">
                {canCreateReport ? '보고서 생성' : '권한 필요'}
              </button>
            )}
          </div>
        </div>
      ) : (
        <>
          {/* 보고서 상태 배너 */}
          <div className="flex items-center gap-3 p-4 bg-blue-50 border border-blue-200 rounded-xl">
            {selectedPeriod === 'day' && report ? (
              <>
                <div className="flex items-center gap-2">
                  {report.status === 'closed' ? (
                    <CheckCircle size={18} className="text-green-600" />
                  ) : (
                    <Clock size={18} className="text-blue-600" />
                  )}
                  <span className="font-medium text-blue-800">
                    보고서 상태:{' '}
                    <span className={report.status === 'closed' ? 'text-green-700' : 'text-blue-700'}>
                      {report.status === 'draft' ? '작성중' :
                        report.status === 'collecting' ? '입력중' :
                          report.status === 'submitted' ? '제출완료' :
                            report.status === 'reviewed' ? '검토완료' : '마감'}
                    </span>
                  </span>
                </div>
                <div className="ml-auto text-sm text-blue-600">
                  제출: {summary.submit_status_count.submitted}/{summary.submit_status_count.total}명 ·
                  미입력: {summary.submit_status_count.not_started}명
                </div>
              </>
            ) : (
              <>
                <div className="flex items-center gap-2">
                  <CalendarRange size={18} className="text-blue-600" />
                  <span className="font-medium text-blue-800">
                    기간 집계: {periodReports.length}건 보고서
                  </span>
                </div>
                <div className="ml-auto text-sm text-blue-600">
                  제출: {summary.submit_status_count.submitted}/{summary.submit_status_count.total}명 ·
                  미입력: {summary.submit_status_count.not_started}명
                </div>
              </>
            )}
          </div>

          {/* 전체 실적 요약 */}
          <div className="card">
            <div className="card-header">
              <h3 className="font-semibold text-gray-800">전체 실적 요약</h3>
              <span className="text-sm text-gray-500">
                {periodLabel} 기준{selectedPeriod === 'day' ? ' · 일일 목표 적용' : usesConfiguredPeriodTarget ? ' · 기간 목표 적용' : ''}
              </span>
            </div>
            <div className="card-body">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {summaryCards.map(item => (
                  <div key={item.label} className={`rounded-lg border p-4 ${item.panelClass}`}>
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className={`text-sm font-bold ${item.labelClass}`}>{item.label}</div>
                        <div className="text-xs text-gray-500 mt-0.5">계획 대비 실적</div>
                      </div>
                      <div className={`text-2xl font-bold tabular-nums ${getRateColor(item.rate)}`}>
                        {item.rate.toFixed(1)}%
                      </div>
                    </div>
                    <div className="grid grid-cols-3 gap-3 mt-4 text-sm">
                      <div>
                        <div className="text-xs text-gray-500">{selectedPeriod === 'day' ? '일일목표' : '계획'}</div>
                        <div className="font-semibold text-gray-800 tabular-nums">{formatNumber(item.plan)} KG</div>
                      </div>
                      <div>
                        <div className="text-xs text-gray-500">실적</div>
                        <div className="font-semibold text-gray-800 tabular-nums">{formatNumber(item.actual)} KG</div>
                      </div>
                      <div>
                        <div className="text-xs text-gray-500">미달량</div>
                        <div className={`font-semibold tabular-nums ${item.shortfall > 0 ? 'text-red-700' : 'text-gray-500'}`}>
                          {item.shortfall > 0 ? `${formatNumber(item.shortfall)} KG` : '-'}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* KPI 카드 */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            <KPIStatusCard
              title="제품 달성율"
              value={`${summaryProductRate.toFixed(1)}%`}
              rate={summaryProductRate}
              subtitle={`${formatNumber(summary.total_product_actual)} / ${formatNumber(summaryProductPlan)} KG`}
            />
            <KPIStatusCard
              title="제품 미달량"
              value={`${formatNumber(productShortfall)} KG`}
              rate={productShortfall === 0 ? 100 : summaryProductRate}
              subtitle={productShortfall === 0 ? '미달 없음' : '만회 필요'}
            />
            <KPIStatusCard
              title="황지 달성율"
              value={`${summaryBilletRate.toFixed(1)}%`}
              rate={summaryBilletRate}
              subtitle={`${formatNumber(summary.total_billet_actual)} / ${formatNumber(summaryBilletPlan)} KG`}
            />
            <KPIStatusCard
              title="황지 미달량"
              value={`${formatNumber(billetShortfall)} KG`}
              rate={billetShortfall === 0 ? 100 : summaryBilletRate}
              subtitle={billetShortfall === 0 ? '미달 없음' : '만회 필요'}
            />
            <KPIStatusCard
              title="제출완료"
              value={`${summary.submit_status_count.submitted}명`}
              rate={summary.submit_status_count.total > 0
                ? (summary.submit_status_count.submitted / summary.submit_status_count.total) * 100
                : 0}
              subtitle={`전체 ${summary.submit_status_count.total}명`}
            />
            <KPIStatusCard
              title="미입력"
              value={`${summary.submit_status_count.not_started}명`}
              rate={summary.submit_status_count.not_started === 0 ? 100 : 50}
              subtitle="입력 필요"
              invertColor
            />
          </div>

          {/* 차트 섹션 */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* 설비별 목표/실적 */}
            <div className="card">
              <div className="card-header">
                <h3 className="font-semibold text-gray-800">
                  {selectedPeriod === 'day' ? '설비별 일일 목표 대비 실적' : '설비별 전일 계획 대비 실적'}
                </h3>
              </div>
              <div className="card-body">
                <ResponsiveContainer width="100%" height={240}>
                  <BarChart data={equipmentChartData} margin={{ top: 5, right: 10, bottom: 5, left: 10 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                    <YAxis tickFormatter={v => `${(v / 1000).toFixed(0)}K`} tick={{ fontSize: 11 }} />
                    <Tooltip formatter={(v: number) => `${v.toLocaleString()} KG`} />
                    <Legend />
                    <Bar dataKey={productPlanLabel} fill="#93c5fd" />
                    <Bar dataKey="제품 실적" fill="#2563eb" />
                    <Bar dataKey={billetPlanLabel} fill="#fcd34d" />
                    <Bar dataKey="황지 실적" fill="#d97706" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* 설비별 달성율 */}
            <div className="card">
              <div className="card-header">
                <h3 className="font-semibold text-gray-800">설비별 달성율 (%)</h3>
              </div>
              <div className="card-body">
                <ResponsiveContainer width="100%" height={240}>
                  <BarChart data={achievementChartData} margin={{ top: 5, right: 10, bottom: 5, left: 10 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                    <YAxis domain={[0, 120]} tickFormatter={v => `${v}%`} tick={{ fontSize: 11 }} />
                    <Tooltip formatter={(v: number) => `${v.toFixed(1)}%`} />
                    <Legend />
                    <Bar dataKey="제품 달성율" radius={[4, 4, 0, 0]}>
                      {achievementChartData.map((entry, idx) => (
                        <Cell
                          key={idx}
                          fill={
                            entry['제품 달성율'] >= 100 ? '#16a34a' :
                              entry['제품 달성율'] >= 90 ? '#d97706' : '#dc2626'
                          }
                        />
                      ))}
                    </Bar>
                    <Bar dataKey="황지 달성율" radius={[4, 4, 0, 0]}>
                      {achievementChartData.map((entry, idx) => (
                        <Cell
                          key={idx}
                          fill={
                            entry['황지 달성율'] >= 100 ? '#4ade80' :
                              entry['황지 달성율'] >= 90 ? '#fbbf24' : '#f87171'
                          }
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* 주간/야간 실적 */}
            <div className="card">
              <div className="card-header">
                <h3 className="font-semibold text-gray-800">근무조별 실적</h3>
              </div>
              <div className="card-body">
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={shiftChartData} margin={{ top: 5, right: 10, bottom: 5, left: 10 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                    <YAxis tickFormatter={v => `${(v / 1000).toFixed(0)}K`} tick={{ fontSize: 11 }} />
                    <Tooltip formatter={(v: number) => `${v.toLocaleString()} KG`} />
                    <Legend />
                    <Bar dataKey={productPlanLabel} fill="#93c5fd" />
                    <Bar dataKey="제품 실적" fill="#2563eb" />
                    <Bar dataKey={billetPlanLabel} fill="#fcd34d" />
                    <Bar dataKey="황지 실적" fill="#d97706" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* 담당자별 입력 현황 */}
            <div className="card">
              <div className="card-header">
                <h3 className="font-semibold text-gray-800 flex items-center gap-2">
                  <Users size={16} />
                  담당자별 입력 현황
                </h3>
              </div>
              <div className="card-body p-0">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-100">
                      {selectedPeriod !== 'day' && (
                        <th className="px-4 py-2.5 text-left text-gray-600 font-medium">보고일자</th>
                      )}
                      <th className="px-4 py-2.5 text-left text-gray-600 font-medium">담당자</th>
                      <th className="px-4 py-2.5 text-center text-gray-600 font-medium">설비</th>
                      <th className="px-4 py-2.5 text-center text-gray-600 font-medium">근무조</th>
                      <th className="px-4 py-2.5 text-center text-gray-600 font-medium">상태</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {entries.map(entry => (
                      <tr key={entry.id} className="hover:bg-gray-50">
                        {selectedPeriod !== 'day' && (
                          <td className="px-4 py-2.5 text-gray-500">
                            {format(parseISO(reportDateById.get(entry.report_id) ?? selectedDate), 'MM.dd')}
                          </td>
                        )}
                        <td className="px-4 py-2.5 text-gray-700">{entry.user_name || '-'}</td>
                        <td className="px-4 py-2.5 text-center font-medium">{entry.equipment}</td>
                        <td className="px-4 py-2.5 text-center text-gray-600">{entry.shift}</td>
                        <td className="px-4 py-2.5 text-center">
                          <SubmitStatusBadge status={entry.submit_status} />
                        </td>
                      </tr>
                    ))}
                    {entries.length === 0 && (
                      <tr>
                        <td colSpan={selectedPeriod !== 'day' ? 5 : 4} className="px-4 py-6 text-center text-gray-400">
                          입력 데이터가 없습니다
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* 상세 실적 테이블 */}
          <div className="card">
            <div className="card-header">
              <h3 className="font-semibold text-gray-800">설비별 상세 실적</h3>
              <div className="flex gap-2">
                {selectedPeriod === 'day' && report && report.status !== 'closed' && canEdit && (
                  <button
                    onClick={() => useReportStore.getState().updateReportStatus(report.id, 'closed')}
                    className="btn-danger text-sm px-3 py-1.5"
                  >
                    마감 처리
                  </button>
                )}
                {selectedPeriod === 'day' && (
                  <button onClick={handlePrint} className="btn-secondary text-sm px-3 py-1.5 flex items-center gap-1.5">
                    <Printer size={14} />
                    출력
                  </button>
                )}
              </div>
            </div>
            <div className="table-wrapper">
              <table className="production-table w-full">
                <thead>
                  <tr>
                    {selectedPeriod !== 'day' && (
                      <th className="px-3 py-2.5" rowSpan={2}>보고일자</th>
                    )}
                    <th className="px-3 py-2.5" rowSpan={2}>설비</th>
                    <th className="px-3 py-2.5" rowSpan={2}>근무조</th>
                    <th className="px-3 py-2.5 text-center" colSpan={4}>제품 (KG)</th>
                    <th className="px-3 py-2.5 text-center" colSpan={4}>황지 (KG)</th>
                    <th className="px-3 py-2.5" rowSpan={2}>주요 사유</th>
                    <th className="px-3 py-2.5" rowSpan={2}>상태</th>
                  </tr>
                  <tr>
                    <th className="px-3 py-2">{selectedPeriod === 'day' ? '목표' : '계획'}</th>
                    <th className="px-3 py-2">실적</th>
                    <th className="px-3 py-2">달성율</th>
                    <th className="px-3 py-2">미달량</th>
                    <th className="px-3 py-2">{selectedPeriod === 'day' ? '목표' : '계획'}</th>
                    <th className="px-3 py-2">실적</th>
                    <th className="px-3 py-2">달성율</th>
                    <th className="px-3 py-2">미달량</th>
                  </tr>
                </thead>
                <tbody>
                  {entries.map(entry => {
                    const target = targetByEquipmentShift.get(`${entry.equipment}-${entry.shift}`);
                    const productPlan = selectedPeriod === 'day' ? target?.product ?? 0 : entry.product_plan;
                    const billetPlan = selectedPeriod === 'day' ? target?.billet ?? 0 : entry.billet_plan;
                    const pRate = productPlan > 0 ? (entry.product_actual / productPlan * 100) : null;
                    const bRate = billetPlan > 0 ? (entry.billet_actual / billetPlan * 100) : null;
                    const pShortfall = Math.max(0, (productPlan || 0) - (entry.product_actual || 0));
                    const bShortfall = Math.max(0, (billetPlan || 0) - (entry.billet_actual || 0));
                    const hasShortfall = pShortfall > 0 || bShortfall > 0;

                    return (
                      <tr key={entry.id} className={hasShortfall && entry.submit_status !== 'not_started' ? 'shortfall-row' : ''}>
                        {selectedPeriod !== 'day' && (
                          <td className="text-center-cell">
                            {format(parseISO(reportDateById.get(entry.report_id) ?? selectedDate), 'MM.dd')}
                          </td>
                        )}
                        <td className="text-center-cell font-bold">{entry.equipment}</td>
                        <td className="text-center-cell">{entry.shift}</td>
                        <td>{formatNumber(productPlan)}</td>
                        <td className={`font-medium ${pRate !== null && pRate < 90 ? 'text-red-600' : ''}`}>
                          {formatNumber(entry.product_actual)}
                        </td>
                        <td className={`text-center-cell font-semibold ${
                          pRate === null ? 'text-gray-400' :
                            pRate >= 100 ? 'text-green-600' :
                              pRate >= 90 ? 'text-yellow-600' : 'text-red-600'
                        }`}>
                          {pRate !== null ? `${pRate.toFixed(1)}%` : '-'}
                        </td>
                        <td className={pShortfall > 0 ? 'text-red-600 font-medium' : 'text-gray-400'}>
                          {pShortfall > 0 ? `▼ ${formatNumber(pShortfall)}` : '-'}
                        </td>
                        <td>{formatNumber(billetPlan)}</td>
                        <td className={`font-medium ${bRate !== null && bRate < 90 ? 'text-red-600' : ''}`}>
                          {formatNumber(entry.billet_actual)}
                        </td>
                        <td className={`text-center-cell font-semibold ${
                          bRate === null ? 'text-gray-400' :
                            bRate >= 100 ? 'text-green-600' :
                              bRate >= 90 ? 'text-yellow-600' : 'text-red-600'
                        }`}>
                          {bRate !== null ? `${bRate.toFixed(1)}%` : '-'}
                        </td>
                        <td className={bShortfall > 0 ? 'text-red-600 font-medium' : 'text-gray-400'}>
                          {bShortfall > 0 ? `▼ ${formatNumber(bShortfall)}` : '-'}
                        </td>
                        <td className="text-center-cell text-xs">
                          {entry.reason_category || <span className="text-gray-300">-</span>}
                        </td>
                        <td className="text-center-cell">
                          <SubmitStatusBadge status={entry.submit_status} />
                        </td>
                      </tr>
                    );
                  })}

                  {/* 합계 행 */}
                  <tr className="bg-blue-50 font-bold border-t-2 border-blue-200">
                    <td colSpan={selectedPeriod !== 'day' ? 3 : 2} className="text-center-cell">합 계</td>
                    <td>{formatNumber(detailProductPlan)}</td>
                    <td>{formatNumber(summary.total_product_actual)}</td>
                    <td className={`text-center-cell ${
                      detailProductRate >= 100 ? 'text-green-600' :
                        detailProductRate >= 90 ? 'text-yellow-600' : 'text-red-600'
                    }`}>
                      {detailProductRate.toFixed(1)}%
                    </td>
                    <td className="text-red-600">
                      {detailProductShortfall > 0
                        ? `▼ ${formatNumber(detailProductShortfall)}`
                        : '-'}
                    </td>
                    <td>{formatNumber(detailBilletPlan)}</td>
                    <td>{formatNumber(summary.total_billet_actual)}</td>
                    <td className={`text-center-cell ${
                      detailBilletRate >= 100 ? 'text-green-600' :
                        detailBilletRate >= 90 ? 'text-yellow-600' : 'text-red-600'
                    }`}>
                      {detailBilletRate.toFixed(1)}%
                    </td>
                    <td className="text-red-600">
                      {detailBilletShortfall > 0
                        ? `▼ ${formatNumber(detailBilletShortfall)}`
                        : '-'}
                    </td>
                    <td colSpan={2}></td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* 미달성 사유 및 만회대책 섹션 */}
          {entries.some(e => e.reason_category && e.submit_status === 'submitted') && (
            <div className="card">
              <div className="card-header">
                <h3 className="font-semibold text-gray-800">미달성 사유 및 만회대책</h3>
              </div>
              <div className="card-body space-y-4">
                {entries
                  .filter(e => e.reason_category && e.submit_status === 'submitted')
                  .map(entry => (
                    <div key={entry.id} className="border border-orange-200 bg-orange-50 rounded-lg p-4">
                      <div className="flex items-center gap-2 mb-3">
                        <AlertTriangle size={16} className="text-orange-500" />
                        <span className="font-semibold text-orange-800">
                          {selectedPeriod !== 'day' && `${format(parseISO(reportDateById.get(entry.report_id) ?? selectedDate), 'MM.dd')} · `}
                          {entry.equipment} / {entry.shift} — {entry.reason_category}
                        </span>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                        {entry.reason_detail && (
                          <div>
                            <div className="text-xs text-gray-500 mb-1 font-medium">상세 원인</div>
                            <div className="text-gray-700">{entry.reason_detail}</div>
                          </div>
                        )}
                        {entry.action_today && (
                          <div>
                            <div className="text-xs text-gray-500 mb-1 font-medium">금일 조치사항</div>
                            <div className="text-gray-700">{entry.action_today}</div>
                          </div>
                        )}
                        {entry.recovery_plan && (
                          <div>
                            <div className="text-xs text-gray-500 mb-1 font-medium">금일 만회계획</div>
                            <div className="text-gray-700">{entry.recovery_plan}</div>
                          </div>
                        )}
                        {entry.support_request && (
                          <div>
                            <div className="text-xs text-gray-500 mb-1 font-medium">지원 요청사항</div>
                            <div className="text-gray-700 text-orange-700">{entry.support_request}</div>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
