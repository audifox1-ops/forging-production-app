export const TARGET_YEAR_2026 = 2026;

export type TargetTotals = {
  product: number;
  billet: number;
};

export type TargetEquipment = 'P15' | 'P5' | 'R/M';

export const TARGET_EQUIPMENT_LIST: TargetEquipment[] = ['P15', 'P5', 'R/M'];

export const DAILY_TARGETS_2026_BY_EQUIPMENT: Record<TargetEquipment, TargetTotals> = {
  P15: { product: 145000, billet: 150000 },
  P5: { product: 70000, billet: 50000 },
  'R/M': { product: 200000, billet: 0 },
};

export const SHIFT_TARGETS_2026_BY_EQUIPMENT: Record<TargetEquipment, TargetTotals> = {
  P15: { product: 72500, billet: 75000 },
  P5: { product: 35000, billet: 25000 },
  'R/M': { product: 100000, billet: 0 },
};

export const WORKDAYS_2026_BY_MONTH = [
  { month: 1, workdays: 21 },
  { month: 2, workdays: 17 },
  { month: 3, workdays: 21 },
  { month: 4, workdays: 22 },
  { month: 5, workdays: 18 },
  { month: 6, workdays: 21 },
  { month: 7, workdays: 21 },
  { month: 8, workdays: 18 },
  { month: 9, workdays: 20 },
  { month: 10, workdays: 20 },
  { month: 11, workdays: 21 },
  { month: 12, workdays: 22 },
] as const;

export const ANNUAL_WORKDAYS_2026 = WORKDAYS_2026_BY_MONTH.reduce(
  (sum, item) => sum + item.workdays,
  0
);

export const DAILY_TARGET_TOTALS_2026 = Object.values(DAILY_TARGETS_2026_BY_EQUIPMENT).reduce<TargetTotals>(
  (sum, target) => ({
    product: sum.product + target.product,
    billet: sum.billet + target.billet,
  }),
  { product: 0, billet: 0 }
);

export const ANNUAL_TARGET_TOTALS_2026 = multiplyTargetTotals(
  DAILY_TARGET_TOTALS_2026,
  ANNUAL_WORKDAYS_2026
);

export function multiplyTargetTotals(target: TargetTotals, multiplier: number): TargetTotals {
  return {
    product: target.product * multiplier,
    billet: target.billet * multiplier,
  };
}

export function getWorkdays2026ForMonth(month: number): number | null {
  return WORKDAYS_2026_BY_MONTH.find(item => item.month === month)?.workdays ?? null;
}

export function get2026PeriodTargetForDate(
  dateString: string,
  period: 'month' | 'year',
  dailyTarget: TargetTotals
): (TargetTotals & { workdays: number }) | null {
  const [yearValue, monthValue] = dateString.split('-');
  const year = Number(yearValue);
  const month = Number(monthValue);

  if (year !== TARGET_YEAR_2026) return null;

  const workdays = period === 'year'
    ? ANNUAL_WORKDAYS_2026
    : getWorkdays2026ForMonth(month);

  if (!workdays) return null;

  return {
    ...multiplyTargetTotals(dailyTarget, workdays),
    workdays,
  };
}
