import { describe, expect, it } from 'vitest';
import { aggregateEquipmentTotals } from '../src/utils/reportEquipmentTotals';
import type { ProductionEntry } from '../src/types';

describe('aggregateEquipmentTotals', () => {
  it('includes P8 values in the R/M group totals', () => {
    const entries: ProductionEntry[] = [
      {
        id: 'entry-rm',
        report_id: 'report-1',
        user_id: 'u1',
        equipment: 'R/M',
        shift: '주간',
        product_plan: 120000,
        product_actual: 100000,
        billet_plan: 0,
        billet_actual: 0,
        next_product_plan: 90000,
        next_billet_plan: 0,
        submit_status: 'draft',
        created_at: '2026-06-02T00:00:00Z',
        updated_at: '2026-06-02T00:00:00Z',
      },
      {
        id: 'entry-p8',
        report_id: 'report-1',
        user_id: 'u2',
        equipment: 'P8',
        shift: '주간',
        product_plan: 30000,
        product_actual: 25000,
        billet_plan: 0,
        billet_actual: 0,
        next_product_plan: 20000,
        next_billet_plan: 0,
        submit_status: 'draft',
        created_at: '2026-06-02T00:00:00Z',
        updated_at: '2026-06-02T00:00:00Z',
      },
    ];

    const totals = aggregateEquipmentTotals(entries);

    expect(totals['R/M'].productPlan).toBe(150000);
    expect(totals['R/M'].productActual).toBe(125000);
    expect(totals['R/M'].nextProductPlan).toBe(110000);
  });
});
