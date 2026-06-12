import { describe, it, expect } from 'vitest';
import {
  calcAchievementRate,
  calcShortfall,
  calcNullableRate,
  calcRate,
  formatNumber,
  formatKG,
  getRateColorClass,
  getTableRateClass,
  getAchievementStatus,
} from '../src/utils/calculations';

describe('calcAchievementRate', () => {
  it('should calculate rate correctly', () => {
    expect(calcAchievementRate(100, 200)).toBe(50);
    expect(calcAchievementRate(200, 200)).toBe(100);
    expect(calcAchievementRate(0, 200)).toBe(0);
  });

  it('should return null when plan is 0', () => {
    expect(calcAchievementRate(100, 0)).toBeNull();
    expect(calcAchievementRate(100, null as any)).toBeNull();
  });
});

describe('calcShortfall', () => {
  it('should calculate shortfall correctly', () => {
    expect(calcShortfall(100, 80)).toBe(20);
    expect(calcShortfall(100, 100)).toBe(0);
    expect(calcShortfall(100, 120)).toBe(0);
  });
});

describe('calcNullableRate', () => {
  it('should calculate nullable rate correctly', () => {
    expect(calcNullableRate(100, 200)).toBe(50);
    expect(calcNullableRate(200, 200)).toBe(100);
  });

  it('should return null when plan is 0', () => {
    expect(calcNullableRate(100, 0)).toBeNull();
  });
});

describe('calcRate', () => {
  it('should calculate rate correctly', () => {
    expect(calcRate(100, 200)).toBe(50);
    expect(calcRate(200, 200)).toBe(100);
    expect(calcRate(0, 200)).toBe(0);
  });

  it('should return 0 when plan is 0', () => {
    expect(calcRate(100, 0)).toBe(0);
  });
});

describe('formatNumber', () => {
  it('should format numbers with locale', () => {
    expect(formatNumber(1000)).toBe('1,000');
    expect(formatNumber(1000000)).toBe('1,000,000');
    expect(formatNumber(0)).toBe('0');
  });

  it('should return dash for null/undefined', () => {
    expect(formatNumber(null)).toBe('-');
    expect(formatNumber(undefined)).toBe('-');
  });
});

describe('formatKG', () => {
  it('should format with KG suffix', () => {
    expect(formatKG(1000)).toBe('1,000 KG');
    expect(formatKG(0)).toBe('0 KG');
  });

  it('should return dash for null/undefined', () => {
    expect(formatKG(null)).toBe('-');
    expect(formatKG(undefined)).toBe('-');
  });
});

describe('getRateColorClass', () => {
  it('should return green for high rates', () => {
    expect(getRateColorClass(100)).toContain('green');
    expect(getRateColorClass(150)).toContain('green');
  });

  it('should return yellow for medium rates', () => {
    expect(getRateColorClass(95)).toContain('yellow');
    expect(getRateColorClass(90)).toContain('yellow');
  });

  it('should return red for low rates', () => {
    expect(getRateColorClass(89)).toContain('red');
    expect(getRateColorClass(50)).toContain('red');
  });

  it('should return gray for null', () => {
    expect(getRateColorClass(null)).toContain('gray');
  });
});

describe('getTableRateClass', () => {
  it('should return correct classes', () => {
    expect(getTableRateClass(100)).toContain('green');
    expect(getTableRateClass(95)).toContain('yellow');
    expect(getTableRateClass(50)).toContain('red');
    expect(getTableRateClass(null)).toContain('gray');
  });
});

describe('getAchievementStatus', () => {
  it('should return normal for high rates', () => {
    expect(getAchievementStatus(100)).toBe('normal');
    expect(getAchievementStatus(150)).toBe('normal');
  });

  it('should return warning for medium rates', () => {
    expect(getAchievementStatus(95)).toBe('warning');
    expect(getAchievementStatus(90)).toBe('warning');
  });

  it('should return danger for low rates', () => {
    expect(getAchievementStatus(89)).toBe('danger');
    expect(getAchievementStatus(50)).toBe('danger');
  });

  it('should return none for null', () => {
    expect(getAchievementStatus(null)).toBe('none');
  });
});
