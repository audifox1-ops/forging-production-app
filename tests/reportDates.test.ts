import { describe, it, expect } from 'vitest';
import {
  getTodayPlanDate,
  getActualDateFromPlanDate,
  getPlanDateFromActualDate,
  getReportPlanDate,
  getLastWorkingDay,
  isWeekend,
  getDayName,
} from '../src/utils/reportDates';

describe('getTodayPlanDate', () => {
  it('should return today in YYYY-MM-DD format', () => {
    const result = getTodayPlanDate();
    expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('should use provided date', () => {
    const date = new Date(2026, 0, 15);
    expect(getTodayPlanDate(date)).toBe('2026-01-15');
  });
});

describe('isWeekend', () => {
  it('should return true for Saturday and Sunday', () => {
    expect(isWeekend('2026-01-10')).toBe(true);  // 토요일
    expect(isWeekend('2026-01-11')).toBe(true);  // 일요일
  });

  it('should return false for weekdays', () => {
    expect(isWeekend('2026-01-12')).toBe(false); // 월요일
    expect(isWeekend('2026-01-15')).toBe(false); // 목요일
  });
});

describe('getLastWorkingDay', () => {
  it('should return previous weekday when given a weekday', () => {
    // 2026-01-15 목요일 -> 2026-01-14 수요일
    expect(getLastWorkingDay('2026-01-15')).toBe('2026-01-14');
  });

  it('should skip weekend when given Monday', () => {
    // 2026-01-12 월요일 -> 2026-01-09 금요일
    expect(getLastWorkingDay('2026-01-12')).toBe('2026-01-09');
  });

  it('should skip weekend when given Tuesday after holiday', () => {
    // 2026-01-06 화요일 -> 2026-01-05 월요일
    expect(getLastWorkingDay('2026-01-06')).toBe('2026-01-05');
  });
});

describe('getActualDateFromPlanDate', () => {
  it('should return previous weekday', () => {
    // 2026-01-15 목요일 -> 2026-01-14 수요일
    expect(getActualDateFromPlanDate('2026-01-15')).toBe('2026-01-14');
  });

  it('should skip weekend when plan date is Monday', () => {
    // 2026-01-12 월요일 -> 2026-01-09 금요일
    expect(getActualDateFromPlanDate('2026-01-12')).toBe('2026-01-09');
  });
});

describe('getPlanDateFromActualDate', () => {
  it('should return next day for weekdays', () => {
    expect(getPlanDateFromActualDate('2026-01-14')).toBe('2026-01-15');
  });

  it('should return next Monday for Friday', () => {
    // 2026-01-09 금요일 -> 2026-01-12 월요일
    expect(getPlanDateFromActualDate('2026-01-09')).toBe('2026-01-12');
  });

  it('should return next Monday for Sunday', () => {
    // 2026-01-11 일요일 -> 2026-01-12 월요일
    expect(getPlanDateFromActualDate('2026-01-11')).toBe('2026-01-12');
  });
});

describe('getReportPlanDate', () => {
  it('should return next_plan_date if exists', () => {
    const report = { report_date: '2026-01-14', next_plan_date: '2026-01-15' };
    expect(getReportPlanDate(report)).toBe('2026-01-15');
  });

  it('should calculate from report_date if next_plan_date is empty', () => {
    const report = { report_date: '2026-01-14', next_plan_date: '' };
    expect(getReportPlanDate(report)).toBe('2026-01-15');
  });
});

describe('getDayName', () => {
  it('should return Korean day name', () => {
    expect(getDayName('2026-01-12')).toBe('월'); // 월요일
    expect(getDayName('2026-01-13')).toBe('화'); // 화요일
    expect(getDayName('2026-01-14')).toBe('수'); // 수요일
    expect(getDayName('2026-01-15')).toBe('목'); // 목요일
    expect(getDayName('2026-01-16')).toBe('금'); // 금요일
    expect(getDayName('2026-01-17')).toBe('토'); // 토요일
    expect(getDayName('2026-01-18')).toBe('일'); // 일요일
  });
});
