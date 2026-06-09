import { addDays, format, parseISO, subDays } from 'date-fns';
import type { ProductionReport } from '../types';

export const REPORT_DATE_FORMAT = 'yyyy-MM-dd';

export function getTodayPlanDate(date = new Date()) {
  return format(date, REPORT_DATE_FORMAT);
}

export function getActualDateFromPlanDate(planDate: string) {
  return format(subDays(parseISO(planDate), 1), REPORT_DATE_FORMAT);
}

export function getPlanDateFromActualDate(actualDate: string) {
  return format(addDays(parseISO(actualDate), 1), REPORT_DATE_FORMAT);
}

export function getReportPlanDate(report: Pick<ProductionReport, 'report_date' | 'next_plan_date'>) {
  return report.next_plan_date || getPlanDateFromActualDate(report.report_date);
}
