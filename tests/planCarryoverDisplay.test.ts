import { describe, expect, it } from 'vitest';
import { getManualPlanChangeMessages } from '../src/utils/planCarryoverDisplay';

describe('plan carryover display', () => {
  it('shows both predecessor expected and manually changed plans', () => {
    expect(getManualPlanChangeMessages(
      { plan_source: 'manual', product_plan: 213615, billet_plan: 100 },
      { next_product_plan: 37036, next_billet_plan: 80 }
    )).toEqual([
      '전일 예상 37,036 → 계획 213,615 (변경됨)',
      '전일 예상 80 → 계획 100 (변경됨)',
    ]);
  });

  it('does not show a change message for carried or unavailable plans', () => {
    expect(getManualPlanChangeMessages(
      { plan_source: 'carried', product_plan: 37036, billet_plan: 80 },
      { next_product_plan: 37036, next_billet_plan: 80 }
    )).toEqual([]);
    expect(getManualPlanChangeMessages(
      { plan_source: 'unavailable', product_plan: 0, billet_plan: 0 },
      { next_product_plan: 0, next_billet_plan: 0 }
    )).toEqual([]);
  });
});
