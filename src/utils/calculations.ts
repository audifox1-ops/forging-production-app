import { ProductionEntry, CalculatedEntry, DashboardSummaryData, EquipmentSummary, ShiftSummary, EQUIPMENT_LIST, SHIFT_LIST } from '../types';


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
  return `${Math.round(rate)}%`;
}

// 미달량 계산
export function calcShortfall(plan: number, actual: number): number {
  return Math.max(0, plan - actual);
}

export function calcEquipmentDailyShortfall(
  entries: Array<Pick<ProductionEntry, 'product_plan' | 'product_actual' | 'billet_plan' | 'billet_actual'>>
) {
  const productPlan = entries.reduce((sum, entry) => sum + (entry.product_plan || 0), 0);
  const productActual = entries.reduce((sum, entry) => sum + (entry.product_actual || 0), 0);
  const billetPlan = entries.reduce((sum, entry) => sum + (entry.billet_plan || 0), 0);
  const billetActual = entries.reduce((sum, entry) => sum + (entry.billet_actual || 0), 0);
  const productShortfall = calcShortfall(productPlan, productActual);
  const billetShortfall = calcShortfall(billetPlan, billetActual);

  return {
    productPlan,
    productActual,
    productShortfall,
    billetPlan,
    billetActual,
    billetShortfall,
    totalPlan: productPlan + billetPlan,
    totalActual: productActual + billetActual,
    hasShortfall: productShortfall > 0 || billetShortfall > 0,
  };
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
  const total_next_product_plan = entries.reduce((s, e) => s + (e.next_product_plan || 0), 0);
  const total_next_billet_plan = entries.reduce((s, e) => s + (e.next_billet_plan || 0), 0);
  const total_next_plan = total_next_product_plan + total_next_billet_plan;
  const total_plan = total_product_plan + total_billet_plan;
  const total_actual = total_product_actual + total_billet_actual;

  const total_achievement_rate = total_plan > 0 ? Math.round((total_actual / total_plan) * 1000) / 10 : 0;
  const product_achievement_rate = total_product_plan > 0 ? Math.round((total_product_actual / total_product_plan) * 1000) / 10 : 0;
  const billet_achievement_rate = total_billet_plan > 0 ? Math.round((total_billet_actual / total_billet_plan) * 1000) / 10 : 0;
  const total_shortfall = Math.max(0, total_plan - total_actual);

  // 설비별 집계
  const by_equipment: EquipmentSummary[] = EQUIPMENT_LIST.map(equipment => {
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
  const by_shift: ShiftSummary[] = SHIFT_LIST.map(shift => {
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
    total_next_product_plan,
    total_next_billet_plan,
    total_next_plan,
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

// 달성율 계산 (계획이 0이면 null 반환)
export function calcNullableRate(actual: number, plan: number): number | null {
  return plan > 0 ? (actual / plan) * 100 : null;
}

// 달성율에 따른 텍스트 색상 클래스
export function getRateColorClass(rate: number | null): string {
  if (rate === null) return 'text-gray-400';
  if (rate >= 100) return 'text-green-700';
  if (rate >= 90) return 'text-yellow-700';
  return 'text-red-700';
}

// 달성율에 따른 테이블용 색상 클래스
export function getTableRateClass(rate: number | null): string {
  if (rate === null) return 'text-gray-400';
  if (rate >= 100) return 'text-green-600';
  if (rate >= 90) return 'text-yellow-600';
  return 'text-red-600';
}

// 간단한 달성율 계산 (plan이 0이면 0 반환)
export function calcRate(actual: number, plan: number): number {
  return plan > 0 ? Math.round((actual / plan) * 1000) / 10 : 0;
}
