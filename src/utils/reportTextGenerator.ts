import { DashboardSummaryData, ProductionEntry, ReasonCategory } from '../types';
import { formatNumber } from './calculations';

// 달성율에 따른 전체 요약 문장 생성
export function generateOverallSummary(summary: DashboardSummaryData): string {
  const rate = summary.total_achievement_rate;
  if (rate >= 100) {
    return '금일 생산은 목표 대비 정상 달성하였습니다.';
  } else if (rate >= 90) {
    return '금일 생산은 목표 대비 일부 미달되었으며, 익일 계획에 미달분을 반영하여 회복 예정입니다.';
  } else {
    return '금일 생산은 목표 대비 크게 미달되었으며, 설비별 원인 분석 및 구체적인 만회대책이 필요합니다.';
  }
}

// 미달성 사유별 자동 문장
export function generateReasonSentence(category: ReasonCategory): string {
  const map: Record<ReasonCategory, string> = {
    '소재 문제': '소재 준비 및 입고 지연으로 계획 대비 생산량이 감소하였습니다.',
    '공정 문제': '선행/후행 공정 간 연계 지연으로 작업 대기시간이 발생하였습니다.',
    '열관리 문제': '가열로 장입, 승온, 홀딩 또는 추출 타이밍 문제로 생산 흐름이 저하되었습니다.',
    '설비 문제': '설비 이상 또는 보전 대기로 인해 계획 대비 실적이 감소하였습니다.',
    '인원/조직 문제': '작업 인원 배치 및 지원 지연으로 생산 효율이 저하되었습니다.',
    '품질 문제': '품질 확인 및 재작업 영향으로 계획 대비 생산량이 감소하였습니다.',
    '계획 변경': '생산 계획 변경으로 인해 목표 대비 실적 차이가 발생하였습니다.',
    '기타': '기타 현장 변수로 인해 목표 대비 실적이 미달되었습니다.',
  };
  return map[category] || '';
}

// 보고서 본문 자동 생성
export function generateReportText(
  summary: DashboardSummaryData,
  entries: ProductionEntry[],
  reportDate: string
): string {
  const lines: string[] = [];

  // 전체 실적 요약
  lines.push(`전일 전체 생산실적은 계획 ${formatNumber(summary.total_plan)}KG 대비 실적 ${formatNumber(summary.total_actual)}KG로 달성율 ${summary.total_achievement_rate.toFixed(1)}%입니다.`);

  // 미달 설비 찾기
  const shortfallEntries = entries.filter(e => {
    const productShortfall = (e.product_plan || 0) - (e.product_actual || 0);
    const billetShortfall = (e.billet_plan || 0) - (e.billet_actual || 0);
    return productShortfall > 0 || billetShortfall > 0;
  });

  if (shortfallEntries.length > 0) {
    const worst = shortfallEntries.reduce((prev, curr) => {
      const prevShortfall = Math.max(
        (prev.product_plan || 0) - (prev.product_actual || 0),
        (prev.billet_plan || 0) - (prev.billet_actual || 0)
      );
      const currShortfall = Math.max(
        (curr.product_plan || 0) - (curr.product_actual || 0),
        (curr.billet_plan || 0) - (curr.billet_actual || 0)
      );
      return currShortfall > prevShortfall ? curr : prev;
    });

    const productShortfall = (worst.product_plan || 0) - (worst.product_actual || 0);
    lines.push(
      `주요 미달 설비는 ${worst.equipment} ${worst.shift}이며, 제품 기준 계획 ${formatNumber(worst.product_plan)}KG 대비 실적 ${formatNumber(worst.product_actual)}KG로 ${formatNumber(productShortfall)}KG 미달되었습니다.`
    );

    // 원인 문장
    if (worst.reason_category) {
      lines.push(`주요 원인: ${generateReasonSentence(worst.reason_category)}`);
      if (worst.reason_detail) {
        lines.push(`상세 내용: ${worst.reason_detail}`);
      }
    }

    // 만회계획
    if (worst.recovery_plan) {
      lines.push(`만회대책: ${worst.recovery_plan}`);
    }
  }

  // 익일 계획
  if (summary.total_shortfall > 0) {
    lines.push(
      `익일 계획에는 전일 미달분 ${formatNumber(summary.total_shortfall)}KG를 반영하여 총 ${formatNumber(summary.total_plan + summary.total_shortfall)}KG 생산을 목표로 합니다.`
    );
  } else {
    lines.push('금일 생산은 계획 대비 정상 달성하였으며, 익일에도 동일한 목표로 운영합니다.');
  }

  return lines.join('\n\n');
}

// KPI 상태 텍스트
export function getKPIStatusText(rate: number): string {
  if (rate >= 100) return '정상';
  if (rate >= 90) return '주의';
  return '위험';
}

// KPI 상태 색상
export function getKPIStatusColor(rate: number): string {
  if (rate >= 100) return '#16a34a';   // green-600
  if (rate >= 90) return '#d97706';    // amber-600
  return '#dc2626';                     // red-600
}
