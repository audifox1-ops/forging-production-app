import { describe, it, expect } from 'vitest';
import { getEquipmentReasonGroups } from '../src/utils/reasonGroups';
import type { ProductionEntry } from '../src/types';

const createEntry = (overrides: Partial<ProductionEntry>): ProductionEntry => ({
  id: 'test',
  report_id: 'report-1',
  user_id: 'user-1',
  equipment: 'P15',
  shift: '주간',
  product_plan: 100,
  product_actual: 80,
  billet_plan: 100,
  billet_actual: 90,
  next_product_plan: 100,
  next_billet_plan: 100,
  submit_status: 'submitted',
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
  ...overrides,
});

describe('getEquipmentReasonGroups', () => {
  it('should return empty array for entries without reasons', () => {
    const entries = [
      createEntry({ id: '1', equipment: 'P15' }),
      createEntry({ id: '2', equipment: 'P5' }),
    ];
    const result = getEquipmentReasonGroups(entries);
    expect(result).toHaveLength(0);
  });

  it('should group entries by equipment', () => {
    const entries = [
      createEntry({
        id: '1',
        equipment: 'P15',
        reason_category: '설비 문제',
        reason_detail: '테스트 원인',
      }),
      createEntry({
        id: '2',
        equipment: 'P15',
        reason_category: '설비 문제',
        reason_detail: '테스트 원인 2',
      }),
      createEntry({
        id: '3',
        equipment: 'P5',
        reason_category: '소재 문제',
        reason_detail: '소재 테스트',
      }),
    ];
    const result = getEquipmentReasonGroups(entries);
    expect(result).toHaveLength(2);
    expect(result[0].equipment).toBe('P15');
    expect(result[0].categories).toContain('설비 문제');
    expect(result[1].equipment).toBe('P5');
  });

  it('should collect unique categories', () => {
    const entries = [
      createEntry({
        id: '1',
        equipment: 'P15',
        reason_category: '설비 문제',
        reason_detail: '원인1',
      }),
      createEntry({
        id: '2',
        equipment: 'P15',
        reason_category: '설비 문제',
        reason_detail: '원인2',
      }),
    ];
    const result = getEquipmentReasonGroups(entries);
    expect(result[0].categories).toHaveLength(1);
    expect(result[0].categories[0]).toBe('설비 문제');
  });

  it('should collect unique reason details', () => {
    const entries = [
      createEntry({
        id: '1',
        equipment: 'P15',
        reason_category: '설비 문제',
        reason_detail: '원인1',
      }),
      createEntry({
        id: '2',
        equipment: 'P15',
        reason_category: '설비 문제',
        reason_detail: '원인2',
      }),
    ];
    const result = getEquipmentReasonGroups(entries);
    expect(result[0].reasonDetails).toHaveLength(2);
  });
});
