import React from 'react';
import { format, parseISO, isWithinInterval, eachDayOfInterval, startOfWeek, endOfWeek, startOfMonth, endOfMonth, eachMonthOfInterval, startOfYear, endOfYear } from 'date-fns';
import { ko } from 'date-fns/locale';
import { AlertTriangle } from 'lucide-react';
import { useReportStore } from '../../store/reportStore';
import { calcDashboardSummary, formatNumber } from '../../utils/calculations';
import { getReportPlanDate, getActualDateFromPlanDate, getDayName } from '../../utils/reportDates';
import type { SummaryPeriod } from '../../types';
import type { ProductionReport } from '../../types';

interface DashboardCalendarProps {
  selectedPlanDate: string;
  selectedPeriod: SummaryPeriod;
  periodRange: { start: Date; end: Date };
  onSelectDate: (date: string) => void;
}

export function DashboardCalendar({ selectedPlanDate, selectedPeriod, periodRange, onSelectDate }: DashboardCalendarProps) {
  const { reports, getEntriesByReport } = useReportStore();

  const reportsByPlanDate = React.useMemo(
    () => new Map(reports.map(report => [getReportPlanDate(report), report])),
    [reports]
  );

  const calendarMonths = React.useMemo(() => {
    if (selectedPeriod !== 'year') return [];
    return eachMonthOfInterval(periodRange);
  }, [periodRange, selectedPeriod]);

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

  const getReportSummary = (targetReport: ProductionReport) =>
    calcDashboardSummary(getEntriesByReport(targetReport.id));

  const getReportsInPlanRange = (range: { start: Date; end: Date }) =>
    reports.filter(targetReport => isWithinInterval(parseISO(getReportPlanDate(targetReport)), range));

  if (selectedPeriod === 'year') {
    return (
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
              onClick={() => onSelectDate(monthPlanDate)}
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
    );
  }

  return (
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
              onClick={() => onSelectDate(planDateKey)}
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
                전일 실적 {format(new Date(actualDateKey), 'M.d')} ({getDayName(actualDateKey)})
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
  );
}
