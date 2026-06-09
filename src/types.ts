import { SHIFT_TARGETS_2026_BY_EQUIPMENT } from './utils/targetConfig';

// 타입 정의

export type UserRole = 'admin' | 'manager' | 'user' | 'viewer';
export type Equipment = 'P15' | 'P5' | 'R/M';
export type Shift = '주간' | '야간';
export type ProductionType = '제품' | '황지';
export type PeriodTargetType = 'weekly' | 'monthly' | 'yearly';

export type ReportStatus = 'draft' | 'collecting' | 'submitted' | 'reviewed';
export type EntryStatus = 'not_started' | 'saved' | 'submitted' | 'returned' | 'approved';

export type ReasonCategory =
  | '소재 문제'
  | '공정 문제'
  | '열관리 문제'
  | '설비 문제'
  | '인원/조직 문제'
  | '품질 문제'
  | '계획 변경'
  | '기타';

export interface User {
  id: string;
  name: string;
  email: string;
  employee_no: string;
  role: UserRole;
  assigned_equipment: Equipment[];
  assigned_shift: Shift | null;
  can_write: boolean;
  can_edit: boolean;
  can_delete: boolean;
  created_at: string;
}

export interface ProductionReport {
  id: string;
  report_date: string;          // YYYY-MM-DD
  next_plan_date: string;       // YYYY-MM-DD
  status: ReportStatus;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface ProductionEntry {
  id: string;
  report_id: string;
  user_id: string;
  user_name?: string;
  equipment: Equipment;
  shift: Shift;
  product_plan: number;
  product_actual: number;
  billet_plan: number;
  billet_actual: number;
  next_product_plan: number;
  next_billet_plan: number;
  product_achievement_rate?: number;
  billet_achievement_rate?: number;
  product_shortfall?: number;
  billet_shortfall?: number;
  reason_category?: ReasonCategory;
  reason_detail?: string;
  action_today?: string;
  recovery_plan?: string;
  support_request?: string;
  submit_status: EntryStatus;
  submitted_at?: string;
  created_at: string;
  updated_at: string;
}

export interface EquipmentTarget {
  id: string;
  equipment: Equipment;
  shift: Shift;
  product_target: number;
  billet_target: number;
  effective_date: string;
  created_at: string;
}

export interface ProductionPeriodTarget {
  id: string;
  period: PeriodTargetType;
  product_target: number;
  billet_target: number;
  effective_date: string;
  created_at: string;
}

export interface ReportComment {
  id: string;
  report_id: string;
  summary: string;
  manager_comment?: string;
  created_at: string;
  updated_at: string;
}

export interface ReportStatusLog {
  id: string;
  report_id: string;
  user_id: string;
  status: string;
  memo?: string;
  created_at: string;
}

// 계산 결과 타입
export interface CalculatedEntry extends ProductionEntry {
  product_achievement_rate: number;
  billet_achievement_rate: number;
  product_shortfall: number;
  billet_shortfall: number;
}

// 대시보드 집계 타입
export interface DashboardSummaryData {
  total_product_plan: number;
  total_product_actual: number;
  total_billet_plan: number;
  total_billet_actual: number;
  total_next_product_plan: number;
  total_next_billet_plan: number;
  total_next_plan: number;
  total_plan: number;
  total_actual: number;
  total_achievement_rate: number;
  product_achievement_rate: number;
  billet_achievement_rate: number;
  total_shortfall: number;
  by_equipment: EquipmentSummary[];
  by_shift: ShiftSummary[];
  submit_status_count: {
    not_started: number;
    saved: number;
    submitted: number;
    total: number;
  };
}

export interface EquipmentSummary {
  equipment: Equipment;
  product_plan: number;
  product_actual: number;
  billet_plan: number;
  billet_actual: number;
  product_achievement_rate: number;
  billet_achievement_rate: number;
}

export interface ShiftSummary {
  shift: Shift;
  product_plan: number;
  product_actual: number;
  billet_plan: number;
  billet_actual: number;
  product_achievement_rate: number;
  billet_achievement_rate: number;
}

// 기본 목표값
export const DEFAULT_TARGETS: Omit<EquipmentTarget, 'id' | 'created_at'>[] = [
  { equipment: 'P15', shift: '주간', product_target: SHIFT_TARGETS_2026_BY_EQUIPMENT.P15.product, billet_target: SHIFT_TARGETS_2026_BY_EQUIPMENT.P15.billet, effective_date: '2026-01-01' },
  { equipment: 'P15', shift: '야간', product_target: SHIFT_TARGETS_2026_BY_EQUIPMENT.P15.product, billet_target: SHIFT_TARGETS_2026_BY_EQUIPMENT.P15.billet, effective_date: '2026-01-01' },
  { equipment: 'P5', shift: '주간', product_target: SHIFT_TARGETS_2026_BY_EQUIPMENT.P5.product, billet_target: SHIFT_TARGETS_2026_BY_EQUIPMENT.P5.billet, effective_date: '2026-01-01' },
  { equipment: 'P5', shift: '야간', product_target: SHIFT_TARGETS_2026_BY_EQUIPMENT.P5.product, billet_target: SHIFT_TARGETS_2026_BY_EQUIPMENT.P5.billet, effective_date: '2026-01-01' },
  { equipment: 'R/M', shift: '주간', product_target: SHIFT_TARGETS_2026_BY_EQUIPMENT['R/M'].product, billet_target: SHIFT_TARGETS_2026_BY_EQUIPMENT['R/M'].billet, effective_date: '2026-01-01' },
  { equipment: 'R/M', shift: '야간', product_target: SHIFT_TARGETS_2026_BY_EQUIPMENT['R/M'].product, billet_target: SHIFT_TARGETS_2026_BY_EQUIPMENT['R/M'].billet, effective_date: '2026-01-01' },
];

export const EQUIPMENT_LIST: Equipment[] = ['P15', 'P5', 'R/M'];
export const SHIFT_LIST: Shift[] = ['주간', '야간'];

export const PERIOD_TARGET_LABELS: Record<PeriodTargetType, string> = {
  weekly: '주간생산량',
  monthly: '월간생산량',
  yearly: '연간생산량',
};

export const REASON_CATEGORIES: ReasonCategory[] = [
  '소재 문제',
  '공정 문제',
  '열관리 문제',
  '설비 문제',
  '인원/조직 문제',
  '품질 문제',
  '계획 변경',
  '기타',
];

export const STATUS_LABELS: Record<ReportStatus, string> = {
  draft: '작성중',
  collecting: '입력중',
  submitted: '제출완료',
  reviewed: '검토완료',
};

export const ENTRY_STATUS_LABELS: Record<EntryStatus, string> = {
  not_started: '미입력',
  saved: '임시저장',
  submitted: '제출완료',
  returned: '반려',
  approved: '승인',
};
