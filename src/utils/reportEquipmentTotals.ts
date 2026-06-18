import type { Equipment, ProductionEntry } from '../types';

export type ReportEquipment = Extract<Equipment, 'P15' | 'P5' | 'R/M'>;

export interface ReportEquipmentTotals {
  productPlan: number;
  productActual: number;
  billetPlan: number;
  billetActual: number;
  nextProductPlan: number;
  nextBilletPlan: number;
}

export type ReportEquipmentTotalsByEquipment = Record<ReportEquipment, ReportEquipmentTotals>;

const REPORT_EQUIPMENT: ReportEquipment[] = ['P15', 'P5', 'R/M'];

export function aggregateEquipmentTotals(entries: ProductionEntry[]) {
  return REPORT_EQUIPMENT.reduce((acc, equipment) => {
    const equipmentEntries = entries.filter(entry =>
      entry.equipment === equipment || (equipment === 'R/M' && entry.equipment === 'P8')
    );

    acc[equipment] = {
      productPlan: equipmentEntries.reduce((sum, entry) => sum + (entry.product_plan || 0), 0),
      productActual: equipmentEntries.reduce((sum, entry) => sum + (entry.product_actual || 0), 0),
      billetPlan: equipment === 'R/M' ? 0 : equipmentEntries.reduce((sum, entry) => sum + (entry.billet_plan || 0), 0),
      billetActual: equipment === 'R/M' ? 0 : equipmentEntries.reduce((sum, entry) => sum + (entry.billet_actual || 0), 0),
      nextProductPlan: equipmentEntries.reduce((sum, entry) => sum + (entry.next_product_plan || 0), 0),
      nextBilletPlan: equipment === 'R/M' ? 0 : equipmentEntries.reduce((sum, entry) => sum + (entry.next_billet_plan || 0), 0),
    };
    return acc;
  }, {} as ReportEquipmentTotalsByEquipment);
}
