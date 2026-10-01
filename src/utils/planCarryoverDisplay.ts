import type { PlanSource } from '../types';

type PlanEntry = {
  plan_source?: PlanSource;
  product_plan: number;
  billet_plan: number;
};

type ExpectedEntry = {
  next_product_plan: number;
  next_billet_plan: number;
};

export function getManualPlanChangeMessages(entry: PlanEntry, predecessor?: ExpectedEntry): string[] {
  if (entry.plan_source !== 'manual' || !predecessor) return [];

  const messages: string[] = [];
  if (entry.product_plan !== predecessor.next_product_plan) {
    messages.push(`전일 예상 ${predecessor.next_product_plan.toLocaleString('ko-KR')} → 계획 ${entry.product_plan.toLocaleString('ko-KR')} (변경됨)`);
  }
  if (entry.billet_plan !== predecessor.next_billet_plan) {
    messages.push(`전일 예상 ${predecessor.next_billet_plan.toLocaleString('ko-KR')} → 계획 ${entry.billet_plan.toLocaleString('ko-KR')} (변경됨)`);
  }
  return messages;
}
