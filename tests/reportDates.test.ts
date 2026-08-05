import { describe, it, expect } from 'vitest';
import {
  getTodayPlanDate,
  getActualDateFromPlanDate,
  getPlanDateFromActualDate,
  getReportPlanDate,
  getLastWorkingDay,
  isWeekend,
  isPublicHoliday,
  isCompanyHoliday,
  isNonWorkingDay,
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
    expect(isWeekend('2026-01-10')).toBe(true);
    expect(isWeekend('2026-01-11')).toBe(true);
  });

  it('should return false for weekdays', () => {
    expect(isWeekend('2026-01-12')).toBe(false);
    expect(isWeekend('2026-01-15')).toBe(false);
  });
});

describe('non-working day helpers', () => {
  it('should identify public holidays', () => {
    expect(isPublicHoliday('2026-03-02')).toBe(true);
    expect(isPublicHoliday('2026-03-03')).toBe(false);
  });

  it('should identify 2026 summer vacation as company holidays', () => {
    expect(isCompanyHoliday('2026-07-30')).toBe(true);
    expect(isCompanyHoliday('2026-08-04')).toBe(true);
    expect(isCompanyHoliday('2026-08-05')).toBe(false);
  });

  it('should identify non-working days', () => {
    expect(isNonWorkingDay('2026-03-01')).toBe(true);
    expect(isNonWorkingDay('2026-03-02')).toBe(true);
    expect(isNonWorkingDay('2026-03-03')).toBe(false);
  });

  it('should treat 2026 summer vacation as non-working days', () => {
    expect(isNonWorkingDay('2026-07-30')).toBe(true);
    expect(isNonWorkingDay('2026-07-31')).toBe(true);
    expect(isNonWorkingDay('2026-08-01')).toBe(true);
    expect(isNonWorkingDay('2026-08-02')).toBe(true);
    expect(isNonWorkingDay('2026-08-03')).toBe(true);
    expect(isNonWorkingDay('2026-08-04')).toBe(true);
    expect(isNonWorkingDay('2026-08-05')).toBe(false);
  });
});

describe('getLastWorkingDay', () => {
  it('should return previous weekday when given a weekday', () => {
    expect(getLastWorkingDay('2026-01-15')).toBe('2026-01-14');
  });

  it('should skip weekend when given Monday', () => {
    expect(getLastWorkingDay('2026-01-12')).toBe('2026-01-09');
  });

  it('should skip public holidays', () => {
    expect(getLastWorkingDay('2026-03-03')).toBe('2026-02-27');
  });

  it('should skip the 2026 summer vacation window', () => {
    expect(getLastWorkingDay('2026-08-05')).toBe('2026-07-29');
  });
});

describe('getActualDateFromPlanDate', () => {
  it('should return previous working day', () => {
    expect(getActualDateFromPlanDate('2026-01-15')).toBe('2026-01-14');
  });

  it('should skip weekend when plan date is Monday', () => {
    expect(getActualDateFromPlanDate('2026-01-12')).toBe('2026-01-09');
  });

  it('should resolve 2026-08-05 plan date to 2026-07-29 actual date', () => {
    expect(getActualDateFromPlanDate('2026-08-05')).toBe('2026-07-29');
  });
});

describe('getPlanDateFromActualDate', () => {
  it('should return next day for weekdays', () => {
    expect(getPlanDateFromActualDate('2026-01-14')).toBe('2026-01-15');
  });

  it('should return next Monday for Friday', () => {
    expect(getPlanDateFromActualDate('2026-01-09')).toBe('2026-01-12');
  });

  it('should return next Monday for Sunday', () => {
    expect(getPlanDateFromActualDate('2026-01-11')).toBe('2026-01-12');
  });

  it('should skip public holidays and weekends', () => {
    expect(getPlanDateFromActualDate('2026-02-27')).toBe('2026-03-03');
  });

  it('should resolve 2026-07-29 actual date to 2026-08-05 plan date', () => {
    expect(getPlanDateFromActualDate('2026-07-29')).toBe('2026-08-05');
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

  it('should recalculate if stored next_plan_date is now a non-working day', () => {
    const report = { report_date: '2026-07-29', next_plan_date: '2026-07-30' };
    expect(getReportPlanDate(report)).toBe('2026-08-05');
  });
});

describe('getDayName', () => {
  it('should return Korean day name', () => {
    expect(getDayName('2026-01-12')).toBe('월');
    expect(getDayName('2026-01-13')).toBe('화');
    expect(getDayName('2026-01-14')).toBe('수');
    expect(getDayName('2026-01-15')).toBe('목');
    expect(getDayName('2026-01-16')).toBe('금');
    expect(getDayName('2026-01-17')).toBe('토');
    expect(getDayName('2026-01-18')).toBe('일');
  });
});
