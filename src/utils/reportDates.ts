import { addDays, format, parseISO, subDays, getDay } from 'date-fns';
import type { ProductionReport } from '../types';

export const REPORT_DATE_FORMAT = 'yyyy-MM-dd';

const KOREA_PUBLIC_HOLIDAYS = new Set([
  '2026-01-01',
  '2026-02-16',
  '2026-02-17',
  '2026-02-18',
  '2026-03-02',
  '2026-05-05',
  '2026-05-25',
  '2026-06-03',
  '2026-06-06',
  '2026-08-17',
  '2026-09-24',
  '2026-09-25',
  '2026-09-26',
  '2026-09-28',
  '2026-10-03',
  '2026-10-09',
  '2026-12-25',
]);

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

export function isPublicHoliday(dateString: string): boolean {
  return KOREA_PUBLIC_HOLIDAYS.has(dateString);
}

export function isNonWorkingDay(dateString: string): boolean {
  return isWeekend(dateString) || isPublicHoliday(dateString);
}

/**
 * 해당 날짜 이전의 마지막 근무일(주말 제외)을 반환
 * 기준일 이전 날짜부터 역방향으로 탐색
 */
export function getLastWorkingDay(beforeDate: string): string {
  let date = subDays(parseISO(beforeDate), 1);
  let dateString = format(date, REPORT_DATE_FORMAT);

  while (isNonWorkingDay(dateString)) {
    date = subDays(date, 1);
    dateString = format(date, REPORT_DATE_FORMAT);
  }

  return dateString;
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
  let date = addDays(parseISO(actualDate), 1);
  let dateString = format(date, REPORT_DATE_FORMAT);

  while (isNonWorkingDay(dateString)) {
    date = addDays(date, 1);
    dateString = format(date, REPORT_DATE_FORMAT);
  }

  return dateString;
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
