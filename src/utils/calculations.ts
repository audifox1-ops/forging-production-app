import { ProductionEntry, CalculatedEntry, DashboardSummaryData, EquipmentSummary, ShiftSummary, Equipment, Shift } from '../types';

// 달성율 계산 (계획이 0이면 null 반환)
export function calcAchievementRate(actual: number, plan: number): number | null {
  if (!plan || plan === 0) return null;
  return Math.round((actual / plan) * 1000) / 10; // 소수점 1자리
}

// 달성율 표시 문자열
export function formatAchievementRate(actual: number, plan: number): string {
  const rate = calcAchievementRate(actual, plan);
  if (rate === null) {
    if (actual > 0) return '-';
    return '-';
  }
  return `${rate.toFixed(1)}%`;
}

// 미달량 계산
export function calcShortfall(plan: number, actual: number): number {
  return Math.max(0, plan - actual);
}

// 달성율 상태 (색상 분류용)
export function getAchievementStatus(rate: number | null): 'normal' | 'warning' | 'danger' | 'none' {
  if (rate === null) return 'none';
  if (rate >= 100) return 'normal';
  if (rate >= 90) return 'warning';
  return 'danger';
}

// 달성율에 따른 Tailwind 색상 클래스
export function getAchievementColorClass(rate: number | null): string {
  const status = getAchievementStatus(rate);
  switch (status) {
    case 'normal': return 'text-green-600 font-semibold';
    case 'warning': return 'text-yellow-600 font-semibold';
    case 'danger': return 'text-red-600 font-bold';
    default: return 'text-gray-400';
  }
}

// 배경색 클래스
export function getAchievementBgClass(rate: number | null): string {
  const status = getAchievementStatus(rate);
  switch (status) {
    case 'normal': return 'bg-green-50';
    case 'warning': return 'bg-yellow-50';
    case 'danger': return 'bg-red-50';
    default: return 'bg-gray-50';
  }
}

// 개별 실적 항목 계산
export function calcEntry(entry: ProductionEntry): CalculatedEntry {
  const product_achievement_rate = calcAchievementRate(entry.product_actual, entry.product_plan) ?? 0;
  const billet_achievement_rate = calcAchievementRate(entry.billet_actual, entry.billet_plan) ?? 0;
  const product_shortfall = calcShortfall(entry.product_plan, entry.product_actual);
  const billet_shortfall = calcShortfall(entry.billet_plan, entry.billet_actual);

  return {
    ...entry,
    product_achievement_rate,
    billet_achievement_rate,
    product_shortfall,
    billet_shortfall,
  };
}

// 대시보드 집계 계산
export function calcDashboardSummary(entries: ProductionEntry[]): DashboardSummaryData {
  const total_product_plan = entries.reduce((s, e) => s + (e.product_plan || 0), 0);
  const total_product_actual = entries.reduce((s, e) => s + (e.product_actual || 0), 0);
  const total_billet_plan = entries.reduce((s, e) => s + (e.billet_plan || 0), 0);
  const total_billet_actual = entries.reduce((s, e) => s + (e.billet_actual || 0), 0);
  const total_plan = total_product_plan + total_billet_plan;
  const total_actual = total_product_actual + total_billet_actual;

  const total_achievement_rate = total_plan > 0 ? Math.round((total_actual / total_plan) * 1000) / 10 : 0;
  const product_achievement_rate = total_product_plan > 0 ? Math.round((total_product_actual / total_product_plan) * 1000) / 10 : 0;
  const billet_achievement_rate = total_billet_plan > 0 ? Math.round((total_billet_actual / total_billet_plan) * 1000) / 10 : 0;
  const total_shortfall = Math.max(0, total_plan - total_actual);

  // 설비별 집계
  const equipments: Equipment[] = ['P15', 'P5', 'R/M'];
  const by_equipment: EquipmentSummary[] = equipments.map(equipment => {
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

  // 근무조별 집계
  const shifts: Shift[] = ['주간', '야간'];
  const by_shift: ShiftSummary[] = shifts.map(shift => {
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

  // 제출 상태 카운트
  const submit_status_count = {
    not_started: entries.filter(e => e.submit_status === 'not_started').length,
    saved: entries.filter(e => e.submit_status === 'saved').length,
    submitted: entries.filter(e => e.submit_status === 'submitted' || e.submit_status === 'approved').length,
    total: entries.length,
  };

  return {
    total_product_plan,
    total_product_actual,
    total_billet_plan,
    total_billet_actual,
    total_plan,
    total_actual,
    total_achievement_rate,
    product_achievement_rate,
    billet_achievement_rate,
    total_shortfall,
    by_equipment,
    by_shift,
    submit_status_count,
  };
}

// 숫자 포맷 (1000단위 콤마)
export function formatNumber(num: number | null | undefined): string {
  if (num === null || num === undefined) return '-';
  return num.toLocaleString('ko-KR');
}

// KG 단위 포맷
export function formatKG(num: number | null | undefined): string {
  if (num === null || num === undefined) return '-';
  return `${num.toLocaleString('ko-KR')} KG`;
}
