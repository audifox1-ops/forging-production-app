import { useMemo } from 'react';
import { useReportStore } from '../store/reportStore';
import { calcDashboardSummary } from '../utils/calculations';
import { getReportPlanDate } from '../utils/reportDates';
import { EQUIPMENT_LIST, SHIFT_LIST } from '../types';
import type { Equipment, Shift, ProductionEntry, EquipmentTarget, ProductionReport } from '../types';

interface UseReportDataParams {
  reportDate?: string;
  selectedPeriod?: 'day' | 'week' | 'month' | 'year';
  selectedPlanDate?: string;
}

export function useReportData({ reportDate, selectedPeriod = 'day', selectedPlanDate }: UseReportDataParams) {
  const { reports, targets, getEntriesByReport } = useReportStore();

  const actualDate = reportDate || '';
  const report = useMemo(
    () => reports.find(r => r.report_date === actualDate),
    [reports, actualDate]
  );

  const entries = useMemo(
    () => (report ? getEntriesByReport(report.id) : []),
    [report, getEntriesByReport]
  );

  const summary = useMemo(() => calcDashboardSummary(entries), [entries]);

  const dailyTargetSummary = useMemo(() => {
    return targets.reduce(
      (acc, target) => ({
        product: acc.product + (target.product_target || 0),
        billet: acc.billet + (target.billet_target || 0),
      }),
      { product: 0, billet: 0 }
    );
  }, [targets]);

  return {
    report,
    entries,
    summary,
    dailyTargetSummary,
    reports,
    targets,
  };
}

export function useEquipmentSummary(entries: ProductionEntry[], targets: EquipmentTarget[]) {
  const targetByEquipmentShift = useMemo(() => {
    return new Map(
      targets.map(target => [
        `${target.equipment}-${target.shift}`,
        {
          product: target.product_target || 0,
          billet: target.billet_target || 0,
        },
      ])
    );
  }, [targets]);

  const equipmentSummaries = useMemo(() => {
    return EQUIPMENT_LIST.map(equipment => {
      const eq_entries = entries.filter(e => e.equipment === equipment);
      const pp = eq_entries.reduce((s, e) => s + (e.product_plan || 0), 0);
      const pa = eq_entries.reduce((s, e) => s + (e.product_actual || 0), 0);
      const bp = eq_entries.reduce((s, e) => s + (e.billet_plan || 0), 0);
      const ba = eq_entries.reduce((s, e) => s + (e.billet_actual || 0), 0);

      return {
        equipment,
        product_plan: pp,
        product_actual: pa,
        billet_plan: bp,
        billet_actual: ba,
        product_achievement_rate: pp > 0 ? Math.round((pa / pp) * 1000) / 10 : 0,
        billet_achievement_rate: bp > 0 ? Math.round((ba / bp) * 1000) / 10 : 0,
      };
    });
  }, [entries]);

  const shiftSummaries = useMemo(() => {
    return SHIFT_LIST.map(shift => {
      const sh_entries = entries.filter(e => e.shift === shift);
      const pp = sh_entries.reduce((s, e) => s + (e.product_plan || 0), 0);
      const pa = sh_entries.reduce((s, e) => s + (e.product_actual || 0), 0);
      const bp = sh_entries.reduce((s, e) => s + (e.billet_plan || 0), 0);
      const ba = sh_entries.reduce((s, e) => s + (e.billet_actual || 0), 0);

      return {
        shift,
        product_plan: pp,
        product_actual: pa,
        billet_plan: bp,
        billet_actual: ba,
        product_achievement_rate: pp > 0 ? Math.round((pa / pp) * 1000) / 10 : 0,
        billet_achievement_rate: bp > 0 ? Math.round((ba / bp) * 1000) / 10 : 0,
      };
    });
  }, [entries]);

  return {
    targetByEquipmentShift,
    equipmentSummaries,
    shiftSummaries,
  };
}

export function useSubmitStatus(entries: ProductionEntry[]) {
  return useMemo(() => {
    return {
      notStarted: entries.filter(e => e.submit_status === 'not_started').length,
      saved: entries.filter(e => e.submit_status === 'saved').length,
      submitted: entries.filter(e => e.submit_status === 'submitted' || e.submit_status === 'approved').length,
      total: entries.length,
    };
  }, [entries]);
}
