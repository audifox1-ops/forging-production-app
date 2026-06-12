import { describe, it, expect } from 'vitest';
import {
  getTodayPlanDate,
  getActualDateFromPlanDate,
  getPlanDateFromActualDate,
  getReportPlanDate,
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

describe('getActualDateFromPlanDate', () => {
  it('should return previous day', () => {
    expect(getActualDateFromPlanDate('2026-01-15')).toBe('2026-01-14');
    expect(getActualDateFromPlanDate('2026-01-01')).toBe('2025-12-31');
  });
});

describe('getPlanDateFromActualDate', () => {
  it('should return next day', () => {
    expect(getPlanDateFromActualDate('2026-01-14')).toBe('2026-01-15');
    expect(getPlanDateFromActualDate('2025-12-31')).toBe('2026-01-01');
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
