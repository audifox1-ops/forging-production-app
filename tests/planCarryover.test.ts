import { describe, expect, it } from 'vitest';
import {
  buildCarryoverPlans,
  getPlanSourceAfterEdit,
  isCarryoverUpdateAllowed,
  type PlanSource,
} from '../src/utils/planCarryover';

const source = (product: number, billet: number) => ({
  next_product_plan: product,
  next_billet_plan: billet,
});

describe('plan carryover rules', () => {
  it('carries the previous report expected plans into a new entry', () => {
    expect(buildCarryoverPlans(source(37036, 12788), { product_plan: 0, billet_plan: 0 })).toEqual({
      product_plan: 37036,
      billet_plan: 12788,
      plan_source: 'carried',
      warning: undefined,
    });
  });

  it('leaves plans unavailable instead of looking further back when the predecessor is empty', () => {
    expect(buildCarryoverPlans(source(0, 0), { product_plan: 999, billet_plan: 888 })).toEqual({
      product_plan: 0,
      billet_plan: 0,
      plan_source: 'unavailable',
      warning: '직전 보고서의 금일 예상이 아직 입력되지 않았습니다.',
    });
  });

  it('marks a carried entry manual when a person changes either previous-day plan', () => {
    expect(getPlanSourceAfterEdit('carried', { product_plan: 213615, billet_plan: 0 }, { product_plan: 37036, billet_plan: 0 })).toBe('manual');
    expect(getPlanSourceAfterEdit('carried', { product_plan: 37036, billet_plan: 0 }, { product_plan: 37036, billet_plan: 0 })).toBe('carried');
  });

  it('does not overwrite manual or unavailable entries during carryover propagation', () => {
    expect(isCarryoverUpdateAllowed('manual', { status: 'collecting' })).toBe(false);
    expect(isCarryoverUpdateAllowed('unavailable', { status: 'collecting' })).toBe(false);
    expect(isCarryoverUpdateAllowed('carried', { status: 'collecting' })).toBe(true);
  });

  it('does not update carried entries after a report is reviewed or closed', () => {
    const lockedStatuses: Array<{ status: 'reviewed' | 'collecting'; closed_at?: string }> = [
      { status: 'reviewed' },
      { status: 'collecting', closed_at: '2026-10-01T10:00:00Z' },
    ];

    lockedStatuses.forEach(report => {
      expect(isCarryoverUpdateAllowed('carried' as PlanSource, report)).toBe(false);
    });
  });
});
