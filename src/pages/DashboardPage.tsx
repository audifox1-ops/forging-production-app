import React from 'react';
import { useNavigate } from 'react-router-dom';
import {
  addDays,
  addMonths,
  addWeeks,
  addYears,
  eachDayOfInterval,
  eachMonthOfInterval,
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
  AlertTriangle, CalendarRange, Clock,
  ChevronLeft, ChevronRight, ClipboardCheck, Download, Printer, PlusCircle, RefreshCw, Users,
} from 'lucide-react';
import { useReportStore } from '../store/reportStore';
import { calcDashboardSummary, formatNumber } from '../utils/calculations';
import { getEquipmentReasonGroups } from '../utils/reasonGroups';
import KPIStatusCard from '../components/KPIStatusCard';
import ReasonContent from '../components/ReasonContent';
import SubmitStatusBadge from '../components/SubmitStatusBadge';
import { EQUIPMENT_LIST, SHIFT_LIST } from '../types';
import type { PeriodTargetType, ProductionReport } from '../types';
import {
  getActualDateFromPlanDate,
  getReportPlanDate,
  getTodayPlanDate,
} from '../utils/reportDates';
import { get2026PeriodTargetForDate } from '../utils/targetConfig';
import { downloadReportExcel } from '../utils/excelTemplate';

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

function shiftPlanDate(dateString: string, period: SummaryPeriod, direction: -1 | 1) {
  const baseDate = parseISO(dateString);
  const nextDate = period === 'week'
    ? addWeeks(baseDate, direction)
    : period === 'month'
      ? addMonths(baseDate, direction)
      : period === 'year'
        ? addYears(baseDate, direction)
        : addDays(baseDate, direction);

  return format(nextDate, 'yyyy-MM-dd');
}

function getRateColor(rate: number) {
  if (rate >= 100) return 'text-green-700';
  if (rate >= 90) return 'text-yellow-700';
  return 'text-red-700';
}

function calcRate(actual: number, plan: number) {
  return plan > 0 ? Math.round((actual / plan) * 1000) / 10 : 0;
}

function calcNullableRate(actual: number, plan: number) {
  return plan > 0 ? (actual / plan) * 100 : null;
}

function getTableRateClass(rate: number | null) {
  if (rate === null) return 'text-gray-400';
  if (rate >= 100) return 'text-green-600';
  if (rate >= 90) return 'text-yellow-600';
  return 'text-red-600';
}

export default function DashboardPage() {
  const navigate = useNavigate();
  const { reports, targets, periodTargets, getEntriesByReport, createReport, getCurrentUser } = useReportStore();
  const currentUser = getCurrentUser();
  const isAdmin = currentUser?.role === 'admin';
  const canWrite = isAdmin || Boolean(currentUser?.can_write);
  const canEdit = isAdmin || Boolean(currentUser?.can_edit);
  const canCreateReport = canWrite || canEdit;
  const [selectedPlanDate, setSelectedPlanDate] = React.useState(getTodayPlanDate());
  const [selectedPeriod, setSelectedPeriod] = React.useState<SummaryPeriod>('day');

  const selectedActualDate = getActualDateFromPlanDate(selectedPlanDate);
  const reportsByPlanDate = React.useMemo(
    () => new Map(reports.map(report => [getReportPlanDate(report), report])),
    [reports]
  );
  const report = reportsByPlanDate.get(selectedPlanDate);
  const periodRange = React.useMemo(
    () => getPeriodRange(selectedPlanDate, selectedPeriod),
    [selectedPlanDate, selectedPeriod]
  );
  const periodReports = React.useMemo(
    () => reports
      .filter(r => isWithinInterval(parseISO(getReportPlanDate(r)), periodRange))
      .sort((a, b) => new Date(getReportPlanDate(a)).getTime() - new Date(getReportPlanDate(b)).getTime()),
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
  const selected2026PeriodTarget = selectedPeriod === 'month' || selectedPeriod === 'year'
    ? get2026PeriodTargetForDate(selectedPlanDate, selectedPeriod, dailyTargetSummary)
    : null;
  const selectedPeriodTarget = PERIOD_TARGET_MAP[selectedPeriod]
    ? periodTargets.find(target => target.period === PERIOD_TARGET_MAP[selectedPeriod])
    : undefined;
  const uses2026PeriodTarget = Boolean(selected2026PeriodTarget);
  const usesConfiguredPeriodTarget = selectedPeriod !== 'day' &&
    !uses2026PeriodTarget &&
    Boolean(selectedPeriodTarget && (selectedPeriodTarget.product_target > 0 || selectedPeriodTarget.billet_target > 0));
  const summaryProductPlan = selectedPeriod === 'day'
    ? dailyTargetSummary.product
    : selected2026PeriodTarget ? selected2026PeriodTarget.product
      : usesConfiguredPeriodTarget ? selectedPeriodTarget!.product_target : summary.total_product_plan;
  const summaryBilletPlan = selectedPeriod === 'day'
    ? dailyTargetSummary.billet
    : selected2026PeriodTarget ? selected2026PeriodTarget.billet
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
  const detailGroups = React.useMemo(() => {
    const sortedEntries = [...entries].sort((a, b) => {
      const equipmentOrder = EQUIPMENT_LIST.indexOf(a.equipment) - EQUIPMENT_LIST.indexOf(b.equipment);
      if (equipmentOrder !== 0) return equipmentOrder;

      const shiftOrder = SHIFT_LIST.indexOf(a.shift) - SHIFT_LIST.indexOf(b.shift);
      if (shiftOrder !== 0) return shiftOrder;

      return (reportDateById.get(a.report_id) ?? '').localeCompare(reportDateById.get(b.report_id) ?? '');
    });

    return EQUIPMENT_LIST.map(equipment => {
      const rows = sortedEntries
        .filter(entry => entry.equipment === equipment)
        .map(entry => {
          const target = targetByEquipmentShift.get(`${entry.equipment}-${entry.shift}`);
          const productPlan = selectedPeriod === 'day' ? target?.product ?? 0 : entry.product_plan;
          const billetPlan = selectedPeriod === 'day' ? target?.billet ?? 0 : entry.billet_plan;
          const productShortfall = Math.max(0, productPlan - (entry.product_actual || 0));
          const billetShortfall = Math.max(0, billetPlan - (entry.billet_actual || 0));

          return {
            entry,
            productPlan,
            billetPlan,
            productRate: calcNullableRate(entry.product_actual, productPlan),
            billetRate: calcNullableRate(entry.billet_actual, billetPlan),
            productShortfall,
            billetShortfall,
            hasShortfall: productShortfall > 0 || billetShortfall > 0,
          };
        });
      const productPlan = rows.reduce((sum, row) => sum + row.productPlan, 0);
      const productActual = rows.reduce((sum, row) => sum + (row.entry.product_actual || 0), 0);
      const billetPlan = rows.reduce((sum, row) => sum + row.billetPlan, 0);
      const billetActual = rows.reduce((sum, row) => sum + (row.entry.billet_actual || 0), 0);

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
        },
      };
    }).filter(group => group.rows.length > 0);
  }, [entries, reportDateById, selectedPeriod, targetByEquipmentShift]);
  const detailRows = React.useMemo(
    () => detailGroups.flatMap(group => group.rows),
    [detailGroups]
  );
  const inputAlerts = React.useMemo(() => {
    const formatRows = (rows: typeof detailRows) =>
      rows.slice(0, 4).map(row => `${row.entry.equipment}/${row.entry.shift}`).join(', ') +
      (rows.length > 4 ? ` 외 ${rows.length - 4}건` : '');
    const formatEquipments = (equipments: string[]) =>
      equipments.slice(0, 4).join(', ') +
      (equipments.length > 4 ? ` 외 ${equipments.length - 4}개 설비` : '');
    const notStartedRows = detailRows.filter(row => row.entry.submit_status === 'not_started');
    const unsubmittedRows = detailRows.filter(row =>
      row.entry.submit_status !== 'submitted' && row.entry.submit_status !== 'approved'
    );
    const missingReasonGroups = detailGroups.filter(group => {
      const hasDailyShortfall = group.total.productShortfall > 0 || group.total.billetShortfall > 0;
      const hasCompleteReason = group.rows.some(row =>
        row.entry.reason_category &&
        row.entry.reason_detail?.trim() &&
        row.entry.action_today?.trim() &&
        row.entry.recovery_plan?.trim()
      );

      return hasDailyShortfall && !hasCompleteReason;
    });
    const missingReasonEquipments = missingReasonGroups.map(group => group.equipment);
    const alerts: { title: string; message: string; tone: 'danger' | 'warning' | 'normal' | 'success' }[] = [];

    if (notStartedRows.length > 0) {
      alerts.push({
        title: `미입력 ${notStartedRows.length}건`,
        message: formatRows(notStartedRows),
        tone: 'danger',
      });
    }
    if (unsubmittedRows.length > 0) {
      alerts.push({
        title: `미제출 ${unsubmittedRows.length}건`,
        message: formatRows(unsubmittedRows),
        tone: 'warning',
      });
    }
    if (missingReasonEquipments.length > 0) {
      alerts.push({
        title: `미달 사유 보완 ${missingReasonEquipments.length}개 설비`,
        message: formatEquipments(missingReasonEquipments),
        tone: 'danger',
      });
    }
    if (alerts.length === 0 && detailRows.length > 0) {
      alerts.push({
        title: '입력 상태 정상',
        message: '미입력, 미제출, 미달 사유 누락 항목이 없습니다.',
        tone: 'success',
      });
    }

    return alerts;
  }, [detailGroups, detailRows]);
  const reasonGroups = React.useMemo(() => getEquipmentReasonGroups(entries), [entries]);
  const reasonGroupsByEquipment = React.useMemo(
    () => new Map(reasonGroups.map(group => [group.equipment, group])),
    [reasonGroups]
  );
  const reasonAnalysis = React.useMemo(() => {
    const reasonMap = new Map<string, {
      category: string;
      count: number;
      productShortfall: number;
      billetShortfall: number;
      equipments: Record<string, number>;
    }>();

    detailGroups.forEach(group => {
      const totalShortfall = group.total.productShortfall + group.total.billetShortfall;
      const reasonGroup = reasonGroupsByEquipment.get(group.equipment);
      const categories = reasonGroup?.categories.length ? reasonGroup.categories : ['사유 미입력'];
      if (!reasonGroup?.categories.length && totalShortfall <= 0) return;

      categories.forEach(category => {
        const current = reasonMap.get(category) ?? {
          category,
          count: 0,
          productShortfall: 0,
          billetShortfall: 0,
          equipments: {},
        };
        current.count += 1;
        current.productShortfall += group.total.productShortfall;
        current.billetShortfall += group.total.billetShortfall;
        current.equipments[group.equipment] = (current.equipments[group.equipment] || 0) + 1;
        reasonMap.set(category, current);
      });
    });

    return Array.from(reasonMap.values())
      .map(item => {
        const mainEquipment = Object.entries(item.equipments)
          .sort((a, b) => b[1] - a[1])[0]?.[0] ?? '-';
        const totalShortfall = item.productShortfall + item.billetShortfall;
        return { ...item, mainEquipment, totalShortfall };
      })
      .sort((a, b) => b.totalShortfall - a.totalShortfall || b.count - a.count);
  }, [detailGroups, reasonGroupsByEquipment]);
  const topReason = reasonAnalysis[0];
  const missingReasonCount = reasonAnalysis.find(item => item.category === '사유 미입력')?.count ?? 0;
  const totalReasonShortfall = reasonAnalysis.reduce((sum, item) => sum + item.totalShortfall, 0);
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
  const submitRate = summary.submit_status_count.total > 0
    ? Math.round((summary.submit_status_count.submitted / summary.submit_status_count.total) * 100)
    : 0;
  const dashboardHighlights = [
    {
      label: '제품 달성',
      value: `${summaryProductRate.toFixed(1)}%`,
      detail: `${formatNumber(summary.total_product_actual)} / ${formatNumber(summaryProductPlan)} KG`,
      className: summaryProductRate >= 100
        ? 'border-green-200 bg-green-50 text-green-800'
        : summaryProductRate >= 90
          ? 'border-amber-200 bg-amber-50 text-amber-800'
          : 'border-red-200 bg-red-50 text-red-800',
    },
    {
      label: '황지 달성',
      value: `${summaryBilletRate.toFixed(1)}%`,
      detail: `${formatNumber(summary.total_billet_actual)} / ${formatNumber(summaryBilletPlan)} KG`,
      className: summaryBilletRate >= 100
        ? 'border-green-200 bg-green-50 text-green-800'
        : summaryBilletRate >= 90
          ? 'border-amber-200 bg-amber-50 text-amber-800'
          : 'border-red-200 bg-red-50 text-red-800',
    },
    {
      label: '제출 현황',
      value: `${submitRate}%`,
      detail: `${summary.submit_status_count.submitted}/${summary.submit_status_count.total}명 제출`,
      className: submitRate === 100
        ? 'border-green-200 bg-green-50 text-green-800'
        : submitRate >= 50
          ? 'border-blue-200 bg-blue-50 text-blue-800'
          : 'border-amber-200 bg-amber-50 text-amber-800',
    },
  ];

  const handleCreateReport = () => {
    if (!canCreateReport) return;
    createReport(selectedActualDate);
  };

  const handleGoInput = () => {
    navigate(`/reports/${selectedActualDate}/input`);
  };

  const handlePrint = () => {
    navigate(`/reports/${selectedActualDate}/print`);
  };

  const handleExcelDownload = async () => {
    if (!report) return;

    try {
      await downloadReportExcel(report, getEntriesByReport(report.id));
    } catch {
      window.alert('엑셀 보고서 파일을 다운로드할 수 없습니다.');
    }
  };

  const handleMoveDate = (direction: -1 | 1) => {
    setSelectedPlanDate(current => shiftPlanDate(current, selectedPeriod, direction));
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
  const calendarDays = React.useMemo(() => {
    if (selectedPeriod === 'year') return [];
    const visibleRange = selectedPeriod === 'month'
      ? {
          start: startOfWeek(periodRange.start, { weekStartsOn: 1 }),
          end: endOfWeek(periodRange.end, { weekStartsOn: 1 }),
        }
      : periodRange;

    return eachDayOfInterval(visibleRange);
  }, [periodRange, selectedPeriod]);
  const calendarMonths = React.useMemo(() => {
    if (selectedPeriod !== 'year') return [];
    return eachMonthOfInterval(periodRange);
  }, [periodRange, selectedPeriod]);
  const getReportSummary = (targetReport: ProductionReport) =>
    calcDashboardSummary(getEntriesByReport(targetReport.id));
  const getReportsInPlanRange = (range: { start: Date; end: Date }) =>
    reports.filter(targetReport => isWithinInterval(parseISO(getReportPlanDate(targetReport)), range));

  return (
    <div className="space-y-6 fade-in">
      <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-xs font-medium text-slate-500">
              <ClipboardCheck size={15} className="text-blue-600" />
              <span>{periodLabel} 운영 현황</span>
            </div>
            <h1 className="mt-1 text-2xl font-bold text-slate-900">생산 대시보드</h1>
            <p className="text-sm text-slate-500 mt-1">
              금일 계획일 {periodRangeLabel}
              {selectedPeriod === 'day' && ` · 전일 실적일 ${format(new Date(selectedActualDate), 'yyyy.MM.dd')}`}
            </p>
          </div>
          <div className="flex items-center gap-2 flex-wrap justify-end">
            <div className="inline-flex rounded-lg border border-slate-200 bg-slate-50 p-1">
              {PERIOD_OPTIONS.map(option => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setSelectedPeriod(option.value)}
                  className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                    selectedPeriod === option.value
                      ? 'bg-blue-600 text-white shadow-sm'
                      : 'text-slate-600 hover:bg-white'
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>
            <div className="inline-flex items-center rounded-lg border border-slate-200 bg-white shadow-sm overflow-hidden">
              <button
                type="button"
                onClick={() => handleMoveDate(-1)}
                className="h-10 w-10 inline-flex items-center justify-center text-slate-600 hover:bg-slate-50 border-r border-slate-200"
                aria-label={`이전 ${periodLabel}로 이동`}
                title={`이전 ${periodLabel}`}
              >
                <ChevronLeft size={18} />
              </button>
              <input
                type="date"
                value={selectedPlanDate}
                onChange={e => setSelectedPlanDate(e.target.value)}
                className="h-10 w-[150px] border-0 bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                aria-label="금일 계획일"
              />
              <button
                type="button"
                onClick={() => handleMoveDate(1)}
                className="h-10 w-10 inline-flex items-center justify-center text-slate-600 hover:bg-slate-50 border-l border-slate-200"
                aria-label={`다음 ${periodLabel}로 이동`}
                title={`다음 ${periodLabel}`}
              >
                <ChevronRight size={18} />
              </button>
            </div>
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
                <button onClick={handleExcelDownload} className="btn-secondary flex items-center gap-2">
                  <Download size={16} />
                  엑셀 다운로드
                </button>
              </>
            ) : null}
          </div>
        </div>
        <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-3">
          {dashboardHighlights.map(item => (
            <div key={item.label} className={`rounded-lg border px-4 py-3 ${item.className}`}>
              <div className="flex items-start justify-between gap-3">
                <div className="text-sm font-semibold">{item.label}</div>
                <div className="text-xl font-bold tabular-nums">{item.value}</div>
              </div>
              <div className="mt-1 text-xs opacity-80 tabular-nums">{item.detail}</div>
            </div>
          ))}
        </div>
      </section>

      <div className="card border-slate-200">
        <div className="card-header bg-slate-50/80">
          <div>
            <h3 className="font-semibold text-gray-800">실적 캘린더</h3>
            <p className="text-xs text-gray-500 mt-0.5">
              금일 계획일 기준 · 전일 실적일 표시
            </p>
          </div>
          <span className="text-xs text-gray-500">{periodLabel} 보기</span>
        </div>
        <div className="card-body">
          {selectedPeriod === 'year' ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {calendarMonths.map(month => {
                const monthRange = { start: startOfMonth(month), end: endOfMonth(month) };
                const monthReports = getReportsInPlanRange(monthRange);
                const monthEntries = monthReports.flatMap(monthReport => getEntriesByReport(monthReport.id));
                const monthSummary = calcDashboardSummary(monthEntries);
                const monthPlanDate = format(month, 'yyyy-MM-dd');
                const isSelectedMonth = format(month, 'yyyy-MM') === format(parseISO(selectedPlanDate), 'yyyy-MM');

                return (
                  <button
                    key={monthPlanDate}
                    type="button"
                    onClick={() => {
                      setSelectedPlanDate(monthPlanDate);
                      setSelectedPeriod('month');
                    }}
                    className={`rounded-lg border p-4 text-left transition-colors ${
                      isSelectedMonth
                        ? 'border-blue-500 bg-blue-50'
                        : 'border-gray-200 bg-white hover:border-blue-300 hover:bg-blue-50/40'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="font-bold text-gray-800">{format(month, 'M월')}</div>
                      <div className="text-xs text-gray-500">{monthReports.length}건</div>
                    </div>
                    <div className={`mt-3 text-2xl font-bold ${
                      monthSummary.total_plan === 0
                        ? 'text-gray-400'
                        : monthSummary.total_achievement_rate >= 100
                          ? 'text-green-700'
                          : monthSummary.total_achievement_rate >= 90
                            ? 'text-yellow-700'
                            : 'text-red-700'
                    }`}>
                      {monthSummary.total_plan > 0 ? `${monthSummary.total_achievement_rate.toFixed(1)}%` : '-'}
                    </div>
                    <div className="mt-1 text-xs text-gray-500">
                      실적 {formatNumber(monthSummary.total_actual)} KG
                    </div>
                  </button>
                );
              })}
            </div>
          ) : (
            <>
              {selectedPeriod !== 'day' && (
                <div className="hidden xl:grid grid-cols-7 gap-2 mb-2 text-center text-xs font-medium text-gray-500">
                  {['월', '화', '수', '목', '금', '토', '일'].map(dayLabel => (
                    <div key={dayLabel}>{dayLabel}</div>
                  ))}
                </div>
              )}
              <div className={`grid gap-2 ${selectedPeriod === 'day' ? 'grid-cols-1' : 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7'}`}>
                {calendarDays.map(day => {
                  const planDateKey = format(day, 'yyyy-MM-dd');
                  const actualDateKey = getActualDateFromPlanDate(planDateKey);
                  const dayReport = reportsByPlanDate.get(planDateKey);
                  const daySummary = dayReport ? getReportSummary(dayReport) : undefined;
                  const isSelected = planDateKey === selectedPlanDate;
                  const isCurrentPeriodDay = isWithinInterval(day, periodRange);

                  return (
                    <button
                      key={planDateKey}
                      type="button"
                      onClick={() => setSelectedPlanDate(planDateKey)}
                      className={`min-h-[116px] rounded-lg border p-3 text-left transition-colors ${
                        isSelected
                          ? 'border-blue-500 bg-blue-50 shadow-sm'
                          : dayReport
                            ? 'border-gray-200 bg-white hover:border-blue-300 hover:bg-blue-50/40'
                            : 'border-gray-100 bg-gray-50 text-gray-400 hover:border-gray-200'
                      } ${isCurrentPeriodDay ? '' : 'opacity-50'}`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="font-bold text-gray-800">{format(day, 'M.d')}</div>
                          <div className="text-[11px] text-gray-500">계획일</div>
                        </div>
                        <div className={`text-lg font-bold ${
                          !daySummary || daySummary.total_plan === 0
                            ? 'text-gray-300'
                            : daySummary.total_achievement_rate >= 100
                              ? 'text-green-700'
                              : daySummary.total_achievement_rate >= 90
                                ? 'text-yellow-700'
                                : 'text-red-700'
                        }`}>
                          {daySummary && daySummary.total_plan > 0 ? `${daySummary.total_achievement_rate.toFixed(0)}%` : '-'}
                        </div>
                      </div>
                      <div className="mt-3 text-xs text-gray-500">
                        전일 실적 {format(new Date(actualDateKey), 'M.d')}
                      </div>
                      {daySummary ? (
                        <div className="mt-2 space-y-1 text-xs">
                          <div className="flex justify-between gap-2">
                            <span className="text-gray-500">실적</span>
                            <span className="font-medium text-gray-700">{formatNumber(daySummary.total_actual)} KG</span>
                          </div>
                          <div className="flex justify-between gap-2">
                            <span className="text-gray-500">제출</span>
                            <span className="font-medium text-gray-700">
                              {daySummary.submit_status_count.submitted}/{daySummary.submit_status_count.total}
                            </span>
                          </div>
                        </div>
                      ) : (
                        <div className="mt-2 text-xs text-gray-400">보고서 없음</div>
                      )}
                    </button>
                  );
                })}
              </div>
            </>
          )}
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
                  <Clock size={18} className="text-blue-600" />
                  <span className="font-medium text-blue-800">
                    보고서 상태:{' '}
                    <span className="text-blue-700">
                      {report.status === 'draft' ? '작성중' :
                        report.status === 'collecting' ? '입력중' :
                          report.status === 'submitted' ? '제출완료' :
                            '검토완료'}
                    </span>
                  </span>
                </div>
                <div className="ml-auto text-sm text-blue-600">
                  전일 실적 {format(new Date(selectedActualDate), 'yyyy.MM.dd')} ·
                  금일 계획 {format(new Date(selectedPlanDate), 'yyyy.MM.dd')} ·
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

          {/* 입력 알림 */}
          <div className="card">
            <div className="card-header">
              <h3 className="font-semibold text-gray-800 flex items-center gap-2">
                <AlertTriangle size={16} className="text-amber-500" />
                입력 알림
              </h3>
              <span className="text-xs text-gray-500">{periodLabel} 기준</span>
            </div>
            <div className="card-body">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {inputAlerts.map(alert => (
                  <div
                    key={alert.title}
                    className={`rounded-lg border p-3 ${
                      alert.tone === 'danger'
                        ? 'border-red-200 bg-red-50'
                        : alert.tone === 'warning'
                          ? 'border-amber-200 bg-amber-50'
                          : alert.tone === 'success'
                            ? 'border-green-200 bg-green-50'
                            : 'border-blue-200 bg-blue-50'
                    }`}
                  >
                    <div className={`text-sm font-bold ${
                      alert.tone === 'danger'
                        ? 'text-red-800'
                        : alert.tone === 'warning'
                          ? 'text-amber-800'
                          : alert.tone === 'success'
                            ? 'text-green-800'
                            : 'text-blue-800'
                    }`}>
                      {alert.title}
                    </div>
                    <div className="text-xs text-gray-600 mt-1 leading-relaxed">{alert.message}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* 전체 실적 요약 */}
          <div className="card">
            <div className="card-header">
              <h3 className="font-semibold text-gray-800">전체 실적 요약</h3>
              <span className="text-sm text-gray-500">
                {periodLabel} 기준{selectedPeriod === 'day' ? ' · 일일 목표 적용' : uses2026PeriodTarget ? ` · 2026 근무일수 ${selected2026PeriodTarget?.workdays}일 적용` : usesConfiguredPeriodTarget ? ' · 기간 목표 적용' : ''}
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
                        <th className="px-4 py-2.5 text-left text-gray-600 font-medium">전일 실적일</th>
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
                            {format(parseISO(reportDateById.get(entry.report_id) ?? selectedActualDate), 'MM.dd')}
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
                {selectedPeriod === 'day' && (
                  <>
                    <button onClick={handleExcelDownload} className="btn-secondary text-sm px-3 py-1.5 flex items-center gap-1.5">
                      <Download size={14} />
                      엑셀
                    </button>
                    <button onClick={handlePrint} className="btn-secondary text-sm px-3 py-1.5 flex items-center gap-1.5">
                      <Printer size={14} />
                      출력
                    </button>
                  </>
                )}
              </div>
            </div>
            <div className="table-wrapper">
              <table className="production-table w-full">
                <thead>
                  <tr>
                    {selectedPeriod !== 'day' && (
                      <th className="px-3 py-2.5" rowSpan={2}>전일 실적일</th>
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
                  {detailGroups.map(group => {
                    const reasonGroup = reasonGroupsByEquipment.get(group.equipment);
                    const reasonLabel = reasonGroup?.categories.join(', ');

                    return (
                    <React.Fragment key={group.equipment}>
                      {group.rows.map((row, rowIndex) => (
                        <tr
                          key={row.entry.id}
                          className={row.hasShortfall && row.entry.submit_status !== 'not_started' ? 'shortfall-row' : ''}
                        >
                          {selectedPeriod !== 'day' && (
                            <td className="text-center-cell">
                              {format(parseISO(reportDateById.get(row.entry.report_id) ?? selectedActualDate), 'MM.dd')}
                            </td>
                          )}
                          <td className="text-center-cell font-bold">{row.entry.equipment}</td>
                          <td className="text-center-cell">{row.entry.shift}</td>
                          <td>{formatNumber(row.productPlan)}</td>
                          <td className={`font-medium ${row.productRate !== null && row.productRate < 90 ? 'text-red-600' : ''}`}>
                            {formatNumber(row.entry.product_actual)}
                          </td>
                          <td className={`text-center-cell font-semibold ${getTableRateClass(row.productRate)}`}>
                            {row.productRate !== null ? `${row.productRate.toFixed(1)}%` : '-'}
                          </td>
                          <td className={row.productShortfall > 0 ? 'text-red-600 font-medium' : 'text-gray-400'}>
                            {row.productShortfall > 0 ? `▼ ${formatNumber(row.productShortfall)}` : '-'}
                          </td>
                          <td>{formatNumber(row.billetPlan)}</td>
                          <td className={`font-medium ${row.billetRate !== null && row.billetRate < 90 ? 'text-red-600' : ''}`}>
                            {formatNumber(row.entry.billet_actual)}
                          </td>
                          <td className={`text-center-cell font-semibold ${getTableRateClass(row.billetRate)}`}>
                            {row.billetRate !== null ? `${row.billetRate.toFixed(1)}%` : '-'}
                          </td>
                          <td className={row.billetShortfall > 0 ? 'text-red-600 font-medium' : 'text-gray-400'}>
                            {row.billetShortfall > 0 ? `▼ ${formatNumber(row.billetShortfall)}` : '-'}
                          </td>
                          {rowIndex === 0 && (
                            <td rowSpan={group.rows.length + 1} className="text-center-cell text-xs align-middle">
                              {reasonLabel || <span className="text-gray-300">-</span>}
                            </td>
                          )}
                          <td className="text-center-cell">
                            <SubmitStatusBadge status={row.entry.submit_status} />
                          </td>
                        </tr>
                      ))}
                      <tr className="bg-slate-50 font-semibold border-t border-slate-200">
                        <td colSpan={selectedPeriod !== 'day' ? 3 : 2} className="text-center-cell">
                          {group.equipment} 합계
                        </td>
                        <td>{formatNumber(group.total.productPlan)}</td>
                        <td>{formatNumber(group.total.productActual)}</td>
                        <td className={`text-center-cell ${getTableRateClass(group.total.productRate)}`}>
                          {group.total.productRate !== null ? `${group.total.productRate.toFixed(1)}%` : '-'}
                        </td>
                        <td className={group.total.productShortfall > 0 ? 'text-red-600 font-medium' : 'text-gray-400'}>
                          {group.total.productShortfall > 0 ? `▼ ${formatNumber(group.total.productShortfall)}` : '-'}
                        </td>
                        <td>{formatNumber(group.total.billetPlan)}</td>
                        <td>{formatNumber(group.total.billetActual)}</td>
                        <td className={`text-center-cell ${getTableRateClass(group.total.billetRate)}`}>
                          {group.total.billetRate !== null ? `${group.total.billetRate.toFixed(1)}%` : '-'}
                        </td>
                        <td className={group.total.billetShortfall > 0 ? 'text-red-600 font-medium' : 'text-gray-400'}>
                          {group.total.billetShortfall > 0 ? `▼ ${formatNumber(group.total.billetShortfall)}` : '-'}
                        </td>
                        <td></td>
                      </tr>
                    </React.Fragment>
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

          {/* 미달 원인 분석 */}
          <div className="card">
            <div className="card-header">
              <h3 className="font-semibold text-gray-800">미달 원인 분석</h3>
              <span className="text-xs text-gray-500">
                {reasonAnalysis.length > 0 ? `${reasonAnalysis.length}개 원인 분류` : '분석 대상 없음'}
              </span>
            </div>
            <div className="card-body">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">
                <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                  <div className="text-xs text-slate-500 mb-1">최다 영향 원인</div>
                  <div className="font-bold text-slate-800">{topReason?.category || '-'}</div>
                  <div className="text-xs text-slate-500 mt-1">
                    {topReason ? `${topReason.count}건 · ${formatNumber(topReason.totalShortfall)} KG` : '미달 사유 데이터 없음'}
                  </div>
                </div>
                <div className="rounded-lg border border-red-200 bg-red-50 p-3">
                  <div className="text-xs text-red-500 mb-1">원인별 미달량 합계</div>
                  <div className="font-bold text-red-800">{formatNumber(totalReasonShortfall)} KG</div>
                  <div className="text-xs text-red-600 mt-1">제품/황지 미달량 합산</div>
                </div>
                <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
                  <div className="text-xs text-amber-600 mb-1">사유 미입력</div>
                  <div className="font-bold text-amber-800">{missingReasonCount}건</div>
                  <div className="text-xs text-amber-700 mt-1">미달 발생 후 보완 필요</div>
                </div>
              </div>

              <div className="table-wrapper">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-100">
                      <th className="px-4 py-2.5 text-left text-gray-600 font-medium">원인</th>
                      <th className="px-4 py-2.5 text-center text-gray-600 font-medium">건수</th>
                      <th className="px-4 py-2.5 text-right text-gray-600 font-medium">제품 미달</th>
                      <th className="px-4 py-2.5 text-right text-gray-600 font-medium">황지 미달</th>
                      <th className="px-4 py-2.5 text-right text-gray-600 font-medium">합계</th>
                      <th className="px-4 py-2.5 text-center text-gray-600 font-medium">주요 설비</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {reasonAnalysis.map(item => (
                      <tr key={item.category} className="hover:bg-gray-50">
                        <td className="px-4 py-2.5 font-medium text-gray-800">{item.category}</td>
                        <td className="px-4 py-2.5 text-center tabular-nums">{item.count}</td>
                        <td className="px-4 py-2.5 text-right tabular-nums">{formatNumber(item.productShortfall)} KG</td>
                        <td className="px-4 py-2.5 text-right tabular-nums">{formatNumber(item.billetShortfall)} KG</td>
                        <td className="px-4 py-2.5 text-right tabular-nums font-semibold text-red-700">
                          {formatNumber(item.totalShortfall)} KG
                        </td>
                        <td className="px-4 py-2.5 text-center">{item.mainEquipment}</td>
                      </tr>
                    ))}
                    {reasonAnalysis.length === 0 && (
                      <tr>
                        <td colSpan={6} className="px-4 py-6 text-center text-gray-400">
                          미달 사유 분석 데이터가 없습니다.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* 미달성 사유 및 만회대책 섹션 */}
          {reasonGroups.length > 0 && (
            <div className="card">
              <div className="card-header">
                <h3 className="font-semibold text-gray-800">미달성 사유 및 만회대책</h3>
                <span className="text-xs text-gray-500">설비별 통합 표시</span>
              </div>
              <div className="card-body">
                <div className="table-wrapper">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-orange-50 border-b border-orange-100">
                        <th className="px-4 py-2.5 text-left text-orange-800 font-medium">설비</th>
                        <th className="px-4 py-2.5 text-left text-orange-800 font-medium">사유</th>
                        <th className="px-4 py-2.5 text-left text-orange-800 font-medium">내용</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-orange-50">
                      {reasonGroups.map(group => (
                        <tr key={group.equipment} className="align-top">
                          <td className="px-4 py-3 font-semibold text-gray-800 whitespace-nowrap">{group.equipment}</td>
                          <td className="px-4 py-3 text-orange-700 whitespace-nowrap">{group.categories.join(', ') || '-'}</td>
                          <td className="px-4 py-3 text-gray-700 leading-relaxed">
                            <ReasonContent group={group} labelClassName="font-medium text-gray-800" />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
