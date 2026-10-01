import type { PlanSource, ProductionReport } from '../types';

export type { PlanSource } from '../types';

type ExpectedPlans = {
  next_product_plan: number;
  next_billet_plan: number;
};

type PreviousDayPlans = {
  product_plan: number;
  billet_plan: number;
};

export function buildCarryoverPlans(
  sourceEntry: ExpectedPlans | undefined,
  fallbackPlans: PreviousDayPlans
) {
  if (!sourceEntry) {
    return {
      ...fallbackPlans,
      plan_source: 'manual' as const,
      warning: undefined,
    };
  }

  const hasExpectedPlan = sourceEntry.next_product_plan > 0 || sourceEntry.next_billet_plan > 0;
  if (!hasExpectedPlan) {
    return {
      product_plan: 0,
      billet_plan: 0,
      plan_source: 'unavailable' as const,
      warning: '직전 보고서의 금일 예상이 아직 입력되지 않았습니다.',
    };
  }

  return {
    product_plan: sourceEntry.next_product_plan,
    billet_plan: sourceEntry.next_billet_plan,
    plan_source: 'carried' as const,
    warning: undefined,
  };
}

export function getPlanSourceAfterEdit(
  currentSource: PlanSource | undefined,
  currentPlans: PreviousDayPlans,
  nextPlans: PreviousDayPlans
): PlanSource {
  const source = currentSource ?? 'manual';
  const plansChanged =
    currentPlans.product_plan !== nextPlans.product_plan ||
    currentPlans.billet_plan !== nextPlans.billet_plan;

  if (plansChanged && (source === 'carried' || source === 'unavailable')) {
    return 'manual';
  }

  return source;
}

export function isCarryoverUpdateAllowed(
  planSource: PlanSource | undefined,
  report: Pick<ProductionReport, 'status'> & { closed_at?: string }
) {
  return (planSource === 'carried' || planSource === 'unavailable') &&
    report.status !== 'reviewed' &&
    !report.closed_at;
}
