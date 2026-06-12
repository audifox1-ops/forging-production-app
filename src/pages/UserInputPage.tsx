import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';
import { Save, Send, AlertCircle, CheckCircle, Info, ChevronDown, ChevronUp, CalendarDays } from 'lucide-react';
import { useReportStore } from '../store/reportStore';
import { Equipment, EquipmentTarget, EQUIPMENT_LIST, ProductionEntry, REASON_CATEGORIES, ReasonCategory, SHIFT_LIST } from '../types';
import { formatNumber } from '../utils/calculations';
import {
  getActualDateFromPlanDate,
  getPlanDateFromActualDate,
  getTodayPlanDate,
} from '../utils/reportDates';

type ReasonFormData = {
  reason_category: ReasonCategory | '';
  reason_detail: string;
};

type EntryQuantityDraft = Pick<
  ProductionEntry,
  'product_plan' | 'product_actual' | 'billet_plan' | 'billet_actual' | 'next_product_plan' | 'next_billet_plan'
>;

function calcEquipmentTargetShortfall(
  entries: Array<Pick<ProductionEntry, 'product_actual' | 'billet_actual'>>,
  targets: EquipmentTarget[],
  equipment: Equipment
) {
  const equipmentTargets = targets.filter(target => target.equipment === equipment);
  const productTarget = equipmentTargets.reduce((sum, target) => sum + (target.product_target || 0), 0);
  const billetTarget = equipmentTargets.reduce((sum, target) => sum + (target.billet_target || 0), 0);
  const productActual = entries.reduce((sum, entry) => sum + (entry.product_actual || 0), 0);
  const billetActual = entries.reduce((sum, entry) => sum + (entry.billet_actual || 0), 0);
  const productShortfall = Math.max(0, productTarget - productActual);
  const billetShortfall = Math.max(0, billetTarget - billetActual);

  return {
    productTarget,
    productActual,
    productShortfall,
    billetTarget,
    billetActual,
    billetShortfall,
    hasShortfall: productShortfall > 0 || billetShortfall > 0,
  };
}

function calcTargetAchievementRate(actual: number, target: number): number | null {
  if (!target) return null;
  return Math.round((actual / target) * 1000) / 10;
}

function formatAchievementRate(rate: number | null) {
  return rate === null ? '-' : `${rate.toFixed(1)}%`;
}

function getAchievementRateClass(rate: number | null) {
  if (rate === null) return 'text-gray-400';
  if (rate >= 100) return 'text-green-700';
  if (rate >= 90) return 'text-yellow-700';
  return 'text-red-700';
}

function getReasonFromEntry(entry?: Partial<ReasonFormData>): ReasonFormData {
  return {
    reason_category: entry?.reason_category || '',
    reason_detail: entry?.reason_detail || '',
  };
}

function hasReasonContent(entry: Partial<ReasonFormData>) {
  return Boolean(
    entry.reason_category ||
    entry.reason_detail?.trim()
  );
}

function getReasonPayload(reason: ReasonFormData) {
  return {
    reason_category: reason.reason_category || null,
    reason_detail: reason.reason_detail.trim() || null,
    action_today: null,
    recovery_plan: null,
    support_request: null,
  } as any;
}

function DailyTargetAchievementPanel({
  equipment,
  targetShortfall,
}: {
  equipment: Equipment;
  targetShortfall: ReturnType<typeof calcEquipmentTargetShortfall>;
}) {
  const productRate = calcTargetAchievementRate(targetShortfall.productActual, targetShortfall.productTarget);
  const billetRate = calcTargetAchievementRate(targetShortfall.billetActual, targetShortfall.billetTarget);
  const items = [
    {
      label: '제품',
      target: targetShortfall.productTarget,
      actual: targetShortfall.productActual,
      shortfall: targetShortfall.productShortfall,
      rate: productRate,
      tone: 'blue',
    },
    {
      label: '황지',
      target: targetShortfall.billetTarget,
      actual: targetShortfall.billetActual,
      shortfall: targetShortfall.billetShortfall,
      rate: billetRate,
      tone: 'amber',
    },
  ];

  return (
    <div className="card border-blue-200">
      <div className="card-header bg-blue-50">
        <div>
          <h3 className="font-semibold text-blue-900">{equipment} 일일 기준 목표 달성율</h3>
          <p className="text-xs text-blue-700 mt-0.5">주간·야간 구분 없이 실적 합계를 설비 일일 목표와 비교합니다.</p>
        </div>
        <span className={`badge ${targetShortfall.hasShortfall ? 'badge-warning' : 'badge-normal'}`}>
          {targetShortfall.hasShortfall ? '미달' : '달성'}
        </span>
      </div>
      <div className="card-body">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {items.map(item => (
            <div
              key={item.label}
              className={`rounded-lg border p-4 ${
                item.tone === 'blue' ? 'border-blue-200 bg-blue-50' : 'border-amber-200 bg-amber-50'
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className={`text-sm font-bold ${item.tone === 'blue' ? 'text-blue-800' : 'text-amber-800'}`}>
                    {item.label}
                  </div>
                  <div className="text-xs text-gray-500 mt-0.5">
                    목표 {formatNumber(item.target)} KG / 실적 {formatNumber(item.actual)} KG
                  </div>
                </div>
                <div className={`text-2xl font-bold tabular-nums ${getAchievementRateClass(item.rate)}`}>
                  {formatAchievementRate(item.rate)}
                </div>
              </div>
              <div className={`mt-3 text-xs font-medium ${
                item.shortfall > 0 ? 'text-red-700' : 'text-green-700'
              }`}>
                {item.target > 0
                  ? item.shortfall > 0
                    ? `부족 ${formatNumber(item.shortfall)} KG`
                    : '일일 기준 목표 달성'
                  : '일일 기준 목표 없음'}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function UserInputPage() {
  const { reportDate } = useParams<{ reportDate: string }>();
  const navigate = useNavigate();
  const { targets, getReport, getEntriesByReport, saveEntry, submitEntry, createReport, getCurrentUser } = useReportStore();
  const currentUser = getCurrentUser();
  const isAdmin = currentUser?.role === 'admin';
  const canWrite = isAdmin || Boolean(currentUser?.can_write);
  const canEdit = isAdmin || Boolean(currentUser?.can_edit);
  const canCreateReport = canWrite || canEdit;
  const [selectedEquipment, setSelectedEquipment] = useState<Equipment>('P15');
  const [entryDrafts, setEntryDrafts] = useState<Record<string, EntryQuantityDraft>>({});

  const actualDate = reportDate || getActualDateFromPlanDate(getTodayPlanDate());
  const planDate = getPlanDateFromActualDate(actualDate);
  let report = getReport(actualDate);
  const entries = report ? getEntriesByReport(report.id) : [];

  // 보고서가 없거나 누락된 항목이 있을 경우(8개 미만) 자동 생성/복구
  const hasReport = Boolean(report);
  const expectedEntriesCount = EQUIPMENT_LIST.length * SHIFT_LIST.length; // 4 * 2 = 8
  const hasMissingEntries = entries.length < expectedEntriesCount;

  useEffect(() => {
    if (canCreateReport && (!hasReport || hasMissingEntries)) {
      createReport(actualDate);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [actualDate, canCreateReport, hasReport, hasMissingEntries]);


  const equipmentTabs = EQUIPMENT_LIST.map(equipment => {
    const equipmentEntries = entries.filter(entry => entry.equipment === equipment);
    const submittedCount = equipmentEntries.filter(entry =>
      entry.submit_status === 'submitted' || entry.submit_status === 'approved'
    ).length;

    return {
      equipment,
      entries: equipmentEntries,
      submittedCount,
    };
  });
  const selectedEntries = entries
    .filter(entry => entry.equipment === selectedEquipment)
    .sort((a, b) => SHIFT_LIST.indexOf(a.shift) - SHIFT_LIST.indexOf(b.shift));
  const selectedEntriesWithDrafts = selectedEntries.map(entry => ({
    ...entry,
    ...entryDrafts[entry.id],
  }));
  const selectedReasonSource = selectedEntries.find(hasReasonContent) ?? selectedEntries[0];
  const selectedTargetShortfall = calcEquipmentTargetShortfall(selectedEntriesWithDrafts, targets, selectedEquipment);
  const selectedHasShortfall = selectedTargetShortfall.hasShortfall;
  const [sharedReasons, setSharedReasons] = useState<Partial<Record<Equipment, ReasonFormData>>>({});
  const [sharedReasonErrors, setSharedReasonErrors] = useState<string[]>([]);
  const [sharedReasonSaved, setSharedReasonSaved] = useState(false);
  const sharedReason = sharedReasons[selectedEquipment] ?? getReasonFromEntry(selectedReasonSource);

  // 자동 탭 선택: useEffect 없이 useMemo로 계산
  // entries가 처음 로드될 때 selectedEquipment가 없으면 첫 번째 설비로 이동
  // (단, 사용자가 직접 탭을 클릭하면 setSelectedEquipment가 호출되어 아래 로직은 무시됨)

  useEffect(() => {
    setSharedReasons(prev => ({
      ...prev,
      [selectedEquipment]: getReasonFromEntry(selectedReasonSource),
    }));
    setSharedReasonErrors([]);
    setSharedReasonSaved(false);
  }, [
    selectedEquipment,
    selectedReasonSource?.id,
    selectedReasonSource?.reason_category,
    selectedReasonSource?.reason_detail,
  ]);

  const prevReportIdRef = React.useRef<string | undefined>(undefined);
  useEffect(() => {
    // report.id가 실제로 다른 보고서로 바뀌었을 때만 draft 초기화 (새 보고서 생성 시 createReport가 재호출되어 id가 바뀌는 문제 방지)
    if (report?.id && prevReportIdRef.current && prevReportIdRef.current !== report.id) {
      setEntryDrafts({});
    }
    prevReportIdRef.current = report?.id;
  }, [report?.id]);

  const handlePlanDateChange = (value: string) => {
    if (!value) return;
    navigate(`/reports/${getActualDateFromPlanDate(value)}/input`);
  };

  const handleSharedReasonChange = (field: keyof ReasonFormData, value: string) => {
    setSharedReasons(prev => ({
      ...prev,
      [selectedEquipment]: {
        ...(prev[selectedEquipment] ?? getReasonFromEntry(selectedReasonSource)),
        [field]: value,
      },
    }));
    setSharedReasonErrors([]);
    setSharedReasonSaved(false);
  };

  const saveSharedReasonForEntries = (skipEntryId?: string) => {
    selectedEntries
      .filter(entry => entry.id !== skipEntryId)
      .forEach(entry => {
        saveEntry({
          id: entry.id,
          report_id: entry.report_id,
          user_id: entry.user_id,
          equipment: entry.equipment,
          shift: entry.shift,
          ...getReasonPayload(sharedReason),
        });
      });
    setSharedReasonSaved(true);
    setTimeout(() => setSharedReasonSaved(false), 2000);
  };

  const validateSharedReason = (requiresReason = selectedHasShortfall) => {
    if (!requiresReason) {
      setSharedReasonErrors([]);
      return true;
    }

    const errors: string[] = [];
    if (!sharedReason.reason_category) errors.push('미달성 사유를 선택해주세요.');
    if (!sharedReason.reason_detail.trim()) errors.push('상세 원인을 입력해주세요.');

    setSharedReasonErrors(errors);
    return errors.length === 0;
  };

  if (!report) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-400">
          {canCreateReport ? '보고서를 불러오는 중...' : '보고서를 생성하려면 관리자에게 쓰기 또는 편집 권한을 받아야 합니다.'}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5 fade-in max-w-5xl mx-auto">
      {/* 헤더 */}
      <div className="card">
        <div className="card-body">
          <div className="flex items-start justify-between flex-wrap gap-3">
            <div>
              <h1 className="text-xl font-bold text-gray-900">생산실적 입력</h1>
              <p className="text-sm text-gray-500 mt-0.5">
                전일 실적일: <span className="font-medium text-gray-700">
                  {format(new Date(actualDate), 'yyyy년 MM월 dd일 (eee)', { locale: ko })}
                </span>
                <span className="mx-1 text-gray-300">·</span>
                금일 계획일: <span className="font-medium text-gray-700">
                  {format(new Date(planDate), 'yyyy년 MM월 dd일 (eee)', { locale: ko })}
                </span>
              </p>
              <p className="text-sm text-gray-500">
                현재 계정: {currentUser?.name || '-'} · {isAdmin ? '관리자 전체 권한' : canWrite || canEdit ? '권한 부여됨' : '읽기 전용'}
              </p>
            </div>
            <div className="flex items-center gap-2 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2">
              <CalendarDays size={16} className="text-gray-500" />
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">금일 계획일 선택</label>
                <input
                  type="date"
                  value={planDate}
                  onChange={event => handlePlanDateChange(event.target.value)}
                  className="form-input py-1.5 w-auto bg-white"
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 안내 배너 */}
      <div className={`flex items-start gap-3 p-4 border rounded-xl ${
        canWrite || canEdit ? 'bg-blue-50 border-blue-200' : 'bg-gray-50 border-gray-200'
      }`}>
        <Info size={18} className={`${canWrite || canEdit ? 'text-blue-500' : 'text-gray-400'} flex-shrink-0 mt-0.5`} />
        <div className={`text-sm ${canWrite || canEdit ? 'text-blue-700' : 'text-gray-600'}`}>
          {canWrite || canEdit ? (
            <>
              <strong>전일 생산계획과 실적, 금일 생산계획을 언제든지 수정할 수 있습니다.</strong>{' '}
              주간·야간 실적 합계가 설비 일일 목표에 미달하면 공통 미달성 사유를 작성해야 합니다.
            </>
          ) : (
            <>관리자에게 쓰기 또는 편집 권한을 받아야 실적을 입력하거나 수정할 수 있습니다.</>
          )}
        </div>
      </div>

      {entries.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <h2 className="text-base font-semibold text-gray-800">부서별 입력</h2>
            <span className="text-xs text-gray-500">
              {selectedEquipment} · {selectedEntries.length}개 항목
            </span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {equipmentTabs.map(tab => {
              const isActive = selectedEquipment === tab.equipment;
              const totalCount = tab.entries.length;
              const activeClass = tab.equipment === 'P15'
                ? 'border-blue-500 bg-blue-50 text-blue-800'
                : tab.equipment === 'P5'
                  ? 'border-purple-500 bg-purple-50 text-purple-800'
                  : tab.equipment === 'R/M'
                    ? 'border-green-500 bg-green-50 text-green-800'
                    : 'border-slate-500 bg-slate-50 text-slate-800';

              return (
                <button
                  key={tab.equipment}
                  type="button"
                  onClick={() => setSelectedEquipment(tab.equipment)}
                  className={`rounded-lg border px-4 py-3 text-left transition-colors ${
                    isActive
                      ? activeClass
                      : 'border-gray-200 bg-white text-gray-700 hover:border-gray-300 hover:bg-gray-50'
                  }`}
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="text-lg font-bold">{tab.equipment}</div>
                    <div className="text-xs font-medium">
                      {tab.submittedCount}/{totalCount || 0}
                    </div>
                  </div>
                  <div className="mt-1 text-xs opacity-80">
                    주간 · 야간 입력
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* 입력 카드 목록 */}
      {entries.length === 0 ? (
        <div className="card">
          <div className="card-body text-center py-10 text-gray-400">
            입력 항목이 없습니다.
          </div>
        </div>
      ) : (
        selectedEntries.length === 0 ? (
          <div className="card">
            <div className="card-body text-center py-10 text-gray-400">
              선택한 부서의 입력 항목이 없습니다.
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <DailyTargetAchievementPanel
              equipment={selectedEquipment}
              targetShortfall={selectedTargetShortfall}
            />
            {selectedEntries.map(entry => (
              <EntryInputCard
                key={entry.id}
                entry={entry}
                reportId={report!.id}
                targets={targets}
                canWrite={canWrite}
                canEdit={canEdit}
                sharedReason={sharedReason}
                equipmentEntries={selectedEntries}
                equipment={selectedEquipment}
                onDraftChange={(entryId, draft) =>
                  setEntryDrafts(prev => ({ ...prev, [entryId]: draft }))
                }
                validateSharedReason={validateSharedReason}
                onSave={saveEntry}
                onSaveSharedReason={saveSharedReasonForEntries}
                onSubmit={submitEntry}
              />
            ))}
            <SharedReasonSection
              equipment={selectedEquipment}
              reason={sharedReason}
              errors={sharedReasonErrors}
              saved={sharedReasonSaved}
              canModify={canWrite || canEdit}
              hasShortfall={selectedHasShortfall}
              targetShortfall={selectedTargetShortfall}
              onChange={handleSharedReasonChange}
              onSave={() => saveSharedReasonForEntries()}
            />
          </div>
        )
      )}
    </div>
  );
}

// 개별 실적 입력 카드
function EntryInputCard({
  entry,
  reportId,
  targets,
  canWrite,
  canEdit,
  sharedReason,
  equipmentEntries,
  equipment,
  onDraftChange,
  validateSharedReason,
  onSave,
  onSaveSharedReason,
  onSubmit,
}: {
  entry: any;
  reportId: string;
  targets: EquipmentTarget[];
  canWrite: boolean;
  canEdit: boolean;
  sharedReason: ReasonFormData;
  equipmentEntries: ProductionEntry[];
  equipment: Equipment;
  onDraftChange: (entryId: string, draft: EntryQuantityDraft) => void;
  validateSharedReason: (requiresReason?: boolean) => boolean;
  onSave: (data: any) => void;
  onSaveSharedReason: (skipEntryId?: string) => void;
  onSubmit: (id: string) => void;
}) {
  const isSubmitted = entry.submit_status === 'submitted' || entry.submit_status === 'approved';
  const canModify = canWrite || canEdit;
  const [formData, setFormData] = useState({
    product_plan: entry.product_plan,
    product_actual: entry.product_actual,
    billet_plan: entry.billet_plan,
    billet_actual: entry.billet_actual,
    next_product_plan: entry.next_product_plan || 0,
    next_billet_plan: entry.next_billet_plan || 0,
  });
  const [errors, setErrors] = useState<string[]>([]);
  const [saved, setSaved] = useState(false);
  const isDirtyRef = React.useRef(false); // 사용자가 현재 편집 중인지 추적

  // 임시저장 후 entry props가 업데이트될 때 formData 동기화
  // 단, 사용자가 현재 편집 중(isDirty)이면 덮어쓰지 않음
  React.useEffect(() => {
    if (isDirtyRef.current) return;
    setFormData({
      product_plan: entry.product_plan,
      product_actual: entry.product_actual,
      billet_plan: entry.billet_plan,
      billet_actual: entry.billet_actual,
      next_product_plan: entry.next_product_plan || 0,
      next_billet_plan: entry.next_billet_plan || 0,
    });
  }, [
    entry.product_plan,
    entry.product_actual,
    entry.billet_plan,
    entry.billet_actual,
    entry.next_product_plan,
    entry.next_billet_plan,
  ]);

  const productShortfall = Math.max(0, (formData.product_plan || 0) - (formData.product_actual || 0));
  const billetShortfall = Math.max(0, (formData.billet_plan || 0) - (formData.billet_actual || 0));
  const equipmentTargetShortfall = calcEquipmentTargetShortfall(
    equipmentEntries.map(equipmentEntry =>
      equipmentEntry.id === entry.id ? { ...equipmentEntry, ...formData } : equipmentEntry
    ),
    targets,
    equipment
  );
  const hasEquipmentShortfall = equipmentTargetShortfall.hasShortfall;
  const todayPlanTotal = (formData.next_product_plan || 0) + (formData.next_billet_plan || 0);
  const shiftTarget = targets.find(target => target.equipment === entry.equipment && target.shift === entry.shift);
  const equipmentTargets = targets.filter(target => target.equipment === entry.equipment);
  const equipmentProductTarget = equipmentTargets.reduce((sum, target) => sum + (target.product_target || 0), 0);
  const equipmentBilletTarget = equipmentTargets.reduce((sum, target) => sum + (target.billet_target || 0), 0);

  const handleChange = (field: string, value: string | number) => {
    const nextFormData = { ...formData, [field]: value };
    setFormData(nextFormData);
    onDraftChange(entry.id, nextFormData);
    setErrors([]);
    setSaved(false);
    isDirtyRef.current = true; // 편집 시작 표시
  };

  const validate = (): boolean => {
    const errs: string[] = [];
    if (formData.product_actual === 0 && formData.billet_actual === 0) {
      errs.push('전일 제품 또는 황지 실적 중 하나 이상 입력해주세요.');
    }
    if (formData.next_product_plan === 0 && formData.next_billet_plan === 0) {
      errs.push('금일 제품 또는 황지 생산계획 중 하나 이상 입력해주세요.');
    }
    setErrors(errs);
    return errs.length === 0;
  };

  const handleSave = () => {
    if (!canModify) return;
    onSave({
      id: entry.id,
      report_id: reportId,
      user_id: entry.user_id,
      equipment: entry.equipment,
      shift: entry.shift,
      ...formData,
      ...getReasonPayload(sharedReason),
    });
    onSaveSharedReason(entry.id);
    isDirtyRef.current = false; // 저장 완료 - 이후 entry props 동기화 허용
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const handleSubmit = () => {
    if (!canModify) return;
    if (!validate()) return;
    if (hasEquipmentShortfall && !validateSharedReason(hasEquipmentShortfall)) {
      setErrors(['미달성 사유는 하단의 설비 공통 입력란에 작성해주세요.']);
      return;
    }
    handleSave();
    onSubmit(entry.id);
  };

  return (
    <div className={`card ${hasEquipmentShortfall && !isSubmitted ? 'border-orange-200' : ''}`}>
      {/* 카드 헤더 */}
      <div className={`card-header ${hasEquipmentShortfall && !isSubmitted ? 'bg-orange-50' : 'bg-gray-50'}`}>
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 rounded-lg flex items-center justify-center font-bold text-sm text-white ${
            entry.equipment === 'P15' ? 'bg-blue-600' :
              entry.equipment === 'P5' ? 'bg-purple-600' :
                entry.equipment === 'R/M' ? 'bg-green-600' : 'bg-slate-600'
          }`}>
            {entry.equipment.replace('/', '')}
          </div>
          <div>
            <div className="font-bold text-gray-800">{entry.equipment} / {entry.shift}</div>
            <div className="text-xs text-gray-500">담당: {entry.user_name || '-'}</div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {isSubmitted ? (
            <span className="flex items-center gap-1 text-green-600 text-sm font-medium">
              <CheckCircle size={16} />
              제출완료
            </span>
          ) : hasEquipmentShortfall ? (
            <span className="flex items-center gap-1 text-orange-500 text-sm">
              <AlertCircle size={16} />
              일일 목표 미달
            </span>
          ) : null}
        </div>
      </div>

      {/* 입력 테이블 */}
      <div className="card-body space-y-5">
        {/* 실적/계획 입력 섹션 */}
        <div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4 text-sm">
            <div className="rounded-lg bg-slate-50 border border-slate-200 p-3">
              <div className="text-xs text-slate-500 mb-1">설비 일일 목표 (주야 합산)</div>
              <div className="flex justify-between gap-3">
                <span className="text-blue-700 font-semibold">제품 {formatNumber(equipmentProductTarget)} KG</span>
                <span className="text-amber-700 font-semibold">황지 {formatNumber(equipmentBilletTarget)} KG</span>
              </div>
            </div>
            <div className="rounded-lg bg-slate-50 border border-slate-200 p-3">
              <div className="text-xs text-slate-500 mb-1">{entry.shift} 기준 목표</div>
              <div className="flex justify-between gap-3">
                <span className="text-blue-700 font-semibold">제품 {formatNumber(shiftTarget?.product_target || 0)} KG</span>
                <span className="text-amber-700 font-semibold">황지 {formatNumber(shiftTarget?.billet_target || 0)} KG</span>
              </div>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
            <div className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-2">
              <div className="text-sm font-bold text-blue-900">전일 실적 입력</div>
              <div className="text-xs text-blue-700 mt-0.5">
                전일 계획과 전일 실적을 입력하고 미달량을 확인합니다.
              </div>
            </div>
            <div className="rounded-lg border border-green-200 bg-green-50 px-3 py-2">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-sm font-bold text-green-900">금일 계획 입력</div>
                  <div className="text-xs text-green-700 mt-0.5">
                    금일 계획일에 생산할 계획 수량만 입력합니다.
                  </div>
                </div>
                <div className="text-right flex-shrink-0">
                  <div className="text-xs text-green-700">합계</div>
                  <div className="text-sm font-bold text-green-900 tabular-nums">
                    {formatNumber(todayPlanTotal)} KG
                  </div>
                </div>
              </div>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr>
                  <th colSpan={5} className="px-3 py-2 bg-blue-800 text-white text-left rounded-tl-lg">
                    전일 실적 입력
                  </th>
                  <th className="px-3 py-2 bg-green-800 text-white text-left rounded-tr-lg border-l-4 border-green-300">
                    금일 계획 입력
                  </th>
                </tr>
                <tr>
                  <th className="px-3 py-2 bg-gray-700 text-white text-center">구분</th>
                  <th className="px-3 py-2 bg-gray-700 text-white text-right">기준 목표 (KG)</th>
                  <th className="px-3 py-2 bg-gray-700 text-white text-right">전일 계획 (KG)</th>
                  <th className="px-3 py-2 bg-blue-600 text-white text-right">전일 실적 (KG)</th>
                  <th className="px-3 py-2 bg-gray-700 text-white text-right">미달량 (KG)</th>
                  <th className="px-3 py-2 bg-green-700 text-white text-right border-l-4 border-green-300">금일 계획 (KG)</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b border-gray-100">
                  <td className="px-3 py-3 font-semibold text-gray-700 bg-gray-50 text-center">제 품</td>
                  <td className="px-3 py-3 text-right font-semibold text-slate-600 bg-slate-50">
                    {formatNumber(shiftTarget?.product_target || 0)}
                  </td>
                  <td className="px-3 py-3 text-right">
                    <input
                      type="number"
                      value={formData.product_plan}
                      onChange={e => handleChange('product_plan', Number(e.target.value))}
                      disabled={!canModify}
                      min={0}
                      className="w-full px-2 py-1.5 border border-gray-200 rounded text-right text-sm bg-gray-50 disabled:bg-gray-100"
                    />
                  </td>
                  <td className="px-3 py-3 text-right">
                    <input
                      type="number"
                      value={formData.product_actual}
                      onChange={e => handleChange('product_actual', Number(e.target.value))}
                      disabled={!canModify}
                      min={0}
                      className="w-full px-2 py-1.5 border border-blue-300 rounded text-right text-sm bg-blue-50 focus:outline-none focus:ring-2 focus:ring-blue-400 disabled:bg-gray-100"
                    />
                  </td>
                  <td className={`px-3 py-3 text-right font-medium ${productShortfall > 0 ? 'text-red-600' : 'text-gray-300'}`}>
                    {productShortfall > 0 ? `▼ ${formatNumber(productShortfall)}` : '-'}
                  </td>
                  <td className="px-3 py-3 text-right border-l-4 border-green-100 bg-green-50/40">
                    <input
                      type="number"
                      value={formData.next_product_plan}
                      onChange={e => handleChange('next_product_plan', Number(e.target.value))}
                      disabled={!canModify}
                      min={0}
                      className="w-full px-2 py-1.5 border border-green-300 rounded text-right text-sm bg-green-50 focus:outline-none focus:ring-2 focus:ring-green-400 disabled:bg-gray-100"
                    />
                  </td>
                </tr>
                <tr>
                  <td className="px-3 py-3 font-semibold text-gray-700 bg-gray-50 text-center">황 지</td>
                  <td className="px-3 py-3 text-right font-semibold text-slate-600 bg-slate-50">
                    {formatNumber(shiftTarget?.billet_target || 0)}
                  </td>
                  <td className="px-3 py-3 text-right">
                    <input
                      type="number"
                      value={formData.billet_plan}
                      onChange={e => handleChange('billet_plan', Number(e.target.value))}
                      disabled={!canModify}
                      min={0}
                      className="w-full px-2 py-1.5 border border-gray-200 rounded text-right text-sm bg-gray-50 disabled:bg-gray-100"
                    />
                  </td>
                  <td className="px-3 py-3 text-right">
                    <input
                      type="number"
                      value={formData.billet_actual}
                      onChange={e => handleChange('billet_actual', Number(e.target.value))}
                      disabled={!canModify}
                      min={0}
                      className="w-full px-2 py-1.5 border border-blue-300 rounded text-right text-sm bg-blue-50 focus:outline-none focus:ring-2 focus:ring-blue-400 disabled:bg-gray-100"
                    />
                  </td>
                  <td className={`px-3 py-3 text-right font-medium ${billetShortfall > 0 ? 'text-red-600' : 'text-gray-300'}`}>
                    {billetShortfall > 0 ? `▼ ${formatNumber(billetShortfall)}` : '-'}
                  </td>
                  <td className="px-3 py-3 text-right border-l-4 border-green-100 bg-green-50/40">
                    <input
                      type="number"
                      value={formData.next_billet_plan}
                      onChange={e => handleChange('next_billet_plan', Number(e.target.value))}
                      disabled={!canModify}
                      min={0}
                      className="w-full px-2 py-1.5 border border-green-300 rounded text-right text-sm bg-green-50 focus:outline-none focus:ring-2 focus:ring-green-400 disabled:bg-gray-100"
                    />
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* 검증 오류 */}
        {errors.length > 0 && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
            <div className="text-red-700 text-sm font-medium mb-1">입력 오류</div>
            {errors.map((err, idx) => (
              <div key={idx} className="text-red-600 text-sm flex items-center gap-1.5">
                <span>•</span>{err}
              </div>
            ))}
          </div>
        )}

        {/* 저장/제출 버튼 */}
        {canModify && (
          <div className="flex items-center justify-between pt-2">
            <div className="text-xs text-gray-400">
              마지막 저장: {entry.updated_at ? format(new Date(entry.updated_at), 'HH:mm') : '-'}
            </div>
            <div className="flex gap-2">
              <button
                onClick={handleSave}
                className="btn-secondary flex items-center gap-2"
              >
                <Save size={16} />
                {saved ? '저장됨 ✓' : '임시저장'}
              </button>
              <button
                onClick={handleSubmit}
                className="btn-success flex items-center gap-2"
              >
                <Send size={16} />
                제출하기
              </button>
            </div>
          </div>
        )}

        {isSubmitted && (
          <div className="flex items-center justify-center gap-2 py-2 text-green-600 font-medium text-sm">
            <CheckCircle size={18} />
            제출완료 상태이며, 필요한 경우 계속 수정할 수 있습니다.
          </div>
        )}
        {!canModify && (
          <div className="flex items-center justify-center gap-2 py-2 text-gray-500 font-medium text-sm">
            <AlertCircle size={18} />
            관리자에게 필요한 권한을 받아야 이 항목을 수정할 수 있습니다.
          </div>
        )}
      </div>
    </div>
  );
}

function SharedReasonSection({
  equipment,
  reason,
  errors,
  saved,
  canModify,
  hasShortfall,
  targetShortfall,
  onChange,
  onSave,
}: {
  equipment: Equipment;
  reason: ReasonFormData;
  errors: string[];
  saved: boolean;
  canModify: boolean;
  hasShortfall: boolean;
  targetShortfall: ReturnType<typeof calcEquipmentTargetShortfall>;
  onChange: (field: keyof ReasonFormData, value: string) => void;
  onSave: () => void;
}) {
  const [isOpen, setIsOpen] = useState(hasShortfall);

  useEffect(() => {
    if (hasShortfall) setIsOpen(true);
  }, [equipment, hasShortfall]);

  return (
    <div className={`card ${hasShortfall ? 'border-orange-200' : ''}`}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={`w-full flex items-center justify-between px-4 py-3 text-sm font-semibold ${
          hasShortfall ? 'bg-orange-50 text-orange-700' : 'bg-gray-50 text-gray-700'
        }`}
      >
        <span className="flex items-center gap-2">
          <AlertCircle size={15} />
          {equipment} 공통 미달성 사유
          {hasShortfall && <span className="text-red-500 text-xs">* 필수 입력</span>}
        </span>
        {isOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
      </button>

      {isOpen && (
        <div className="card-body space-y-4 bg-orange-50/30">
          {hasShortfall ? (
            <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
              <AlertCircle size={15} className="flex-shrink-0 mt-0.5" />
              <div>
                <div>주야합산 실적이 설비 일일 목표에 미달했습니다. 사유는 이 공통 입력란에 한 번만 작성합니다.</div>
                <div className="mt-1 text-xs">
                  <span className="mr-3">
                    제품 목표 {formatNumber(targetShortfall.productTarget)} KG / 실적 {formatNumber(targetShortfall.productActual)} KG
                    {targetShortfall.productShortfall > 0 ? ` · 부족 ${formatNumber(targetShortfall.productShortfall)} KG` : ' · 달성'}
                  </span>
                  <span>
                    황지 목표 {formatNumber(targetShortfall.billetTarget)} KG / 실적 {formatNumber(targetShortfall.billetActual)} KG
                    {targetShortfall.billetShortfall > 0 ? ` · 부족 ${formatNumber(targetShortfall.billetShortfall)} KG` : ' · 달성'}
                  </span>
                </div>
              </div>
            </div>
          ) : (
            <div className="text-sm text-gray-500">
              현재 선택한 설비는 주야합산 일일 목표 기준 미달이 없습니다. 필요 시 공통 메모로 작성할 수 있습니다.
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="form-label">
                미달성 사유 {hasShortfall && <span className="text-red-500">*</span>}
              </label>
              <select
                value={reason.reason_category}
                onChange={e => onChange('reason_category', e.target.value)}
                disabled={!canModify}
                className="form-select"
              >
                <option value="">선택하세요</option>
                {REASON_CATEGORIES.map(cat => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
            </div>

            {reason.reason_category && (
              <div className="text-xs text-gray-500 bg-gray-50 border border-gray-200 rounded-lg p-3">
                <strong className="text-gray-700">작성 가이드:</strong>
                <div className="mt-1">
                  {getReasonGuide(reason.reason_category as ReasonCategory)}
                </div>
              </div>
            )}
          </div>

          <div>
            <label className="form-label">
              상세 원인 {hasShortfall && <span className="text-red-500">*</span>}
            </label>
            <textarea
              value={reason.reason_detail}
              onChange={e => onChange('reason_detail', e.target.value)}
              disabled={!canModify}
              placeholder="구체적인 원인을 작성해 주세요 (설비명, 시간, 수량 등 포함)"
              className="form-textarea"
              rows={3}
            />
          </div>

          {errors.length > 0 && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
              <div className="text-red-700 text-sm font-medium mb-1">미달성 사유 입력 오류</div>
              {errors.map((error, index) => (
                <div key={index} className="text-red-600 text-sm flex items-center gap-1.5">
                  <span>•</span>{error}
                </div>
              ))}
            </div>
          )}

          {canModify && (
            <div className="flex justify-end">
              <button onClick={onSave} className="btn-secondary flex items-center gap-2">
                <Save size={16} />
                {saved ? '사유 저장됨 ✓' : '공통 사유 저장'}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function getReasonGuide(category: ReasonCategory): string {
  const guides: Record<ReasonCategory, string> = {
    '소재 문제': '소재명, 입고 예정 시간, 실제 입고 시간, 부족 수량을 기재해 주세요.',
    '공정 문제': '병목 공정명, 대기 시간, 작업 순서 문제를 구체적으로 작성해 주세요.',
    '열관리 문제': '가열로 번호, 장입/추출 지연 시간, 홀딩 시간 문제를 작성해 주세요.',
    '설비 문제': '설비명, 고장 발생 시간, 보전 완료 시간, 영향 생산량을 작성해 주세요.',
    '인원/조직 문제': '인원 배치 현황, 대기 발생 시간, 조치 내용을 작성해 주세요.',
    '품질 문제': '불량 유형, 재작업 수량, 품질 확인 대기 시간을 작성해 주세요.',
    '계획 변경': '변경 사유, 변경 전/후 계획 수량, 조정 시점을 작성해 주세요.',
    '기타': '발생 상황, 영향 시간, 수량 영향을 구체적으로 작성해 주세요.',
  };
  return guides[category] || '';
}
