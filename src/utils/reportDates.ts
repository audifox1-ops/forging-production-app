import { addDays, format, parseISO, subDays, getDay } from 'date-fns';
import type { ProductionReport } from '../types';

export const REPORT_DATE_FORMAT = 'yyyy-MM-dd';

export function getTodayPlanDate(date = new Date()) {
  return format(date, REPORT_DATE_FORMAT);
}

/**
 * 요일 번호 반환 (0=일요일, 6=토요일)
 */
function getDayOfWeek(dateString: string): number {
  return getDay(parseISO(dateString));
}

/**
 * 날짜가 주말인지 확인
 */
export function isWeekend(dateString: string): boolean {
  const day = getDayOfWeek(dateString);
  return day === 0 || day === 6;
}

/**
 * 해당 날짜 이전의 마지막 근무일(주말 제외)을 반환
 * 기준일 이전 날짜부터 역방향으로 탐색
 */
export function getLastWorkingDay(beforeDate: string): string {
  let date = subDays(parseISO(beforeDate), 1);
  let day = getDay(date);

  while (day === 0 || day === 6) {
    date = subDays(date, 1);
    day = getDay(date);
  }

  return format(date, REPORT_DATE_FORMAT);
}

/**
 * 계획일 기준 전일 실적일 계산 (주말 자동 스킵)
 * planDate의 이전 근무일을 반환
 */
export function getActualDateFromPlanDate(planDate: string) {
  return getLastWorkingDay(planDate);
}

/**
 * 실적일 기준 계획일 계산
 * 실적일이 금요일이면 다음 월요일, 나머지는 다음 날
 */
export function getPlanDateFromActualDate(actualDate: string) {
  const day = getDayOfWeek(actualDate);

  if (day === 5) {
    return format(addDays(parseISO(actualDate), 3), REPORT_DATE_FORMAT);
  }
  if (day === 6) {
    return format(addDays(parseISO(actualDate), 2), REPORT_DATE_FORMAT);
  }
  if (day === 0) {
    return format(addDays(parseISO(actualDate), 1), REPORT_DATE_FORMAT);
  }
  return format(addDays(parseISO(actualDate), 1), REPORT_DATE_FORMAT);
}

export function getReportPlanDate(report: Pick<ProductionReport, 'report_date' | 'next_plan_date'>) {
  return report.next_plan_date || getPlanDateFromActualDate(report.report_date);
}

/**
 * 날짜에서 요일명 반환
 */
export function getDayName(dateString: string): string {
  const dayNames = ['일', '월', '화', '수', '목', '금', '토'];
  return dayNames[getDayOfWeek(dateString)];
}
