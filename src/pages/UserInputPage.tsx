import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';
import { Save, Send, AlertCircle, CheckCircle, Info, ChevronDown, ChevronUp, CalendarDays } from 'lucide-react';
import { useReportStore } from '../store/reportStore';
import { Equipment, EquipmentTarget, EQUIPMENT_LIST, REASON_CATEGORIES, ReasonCategory, SHIFT_LIST } from '../types';
import { formatNumber } from '../utils/calculations';
import {
  getActualDateFromPlanDate,
  getPlanDateFromActualDate,
  getTodayPlanDate,
} from '../utils/reportDates';

type ReasonFormData = {
  reason_category: ReasonCategory | '';
  reason_detail: string;
  action_today: string;
  recovery_plan: string;
  support_request: string;
};

const EMPTY_REASON: ReasonFormData = {
  reason_category: '',
  reason_detail: '',
  action_today: '',
  recovery_plan: '',
  support_request: '',
};

function getEntryShortfall(entry: { product_plan?: number; product_actual?: number; billet_plan?: number; billet_actual?: number }) {
  const productShortfall = Math.max(0, (entry.product_plan || 0) - (entry.product_actual || 0));
  const billetShortfall = Math.max(0, (entry.billet_plan || 0) - (entry.billet_actual || 0));
  return { productShortfall, billetShortfall, hasShortfall: productShortfall > 0 || billetShortfall > 0 };
}

function getReasonFromEntry(entry?: Partial<ReasonFormData>): ReasonFormData {
  return {
    reason_category: entry?.reason_category || '',
    reason_detail: entry?.reason_detail || '',
    action_today: entry?.action_today || '',
    recovery_plan: entry?.recovery_plan || '',
    support_request: entry?.support_request || '',
  };
}

function hasReasonContent(entry: Partial<ReasonFormData>) {
  return Boolean(
    entry.reason_category ||
    entry.reason_detail?.trim() ||
    entry.action_today?.trim() ||
    entry.recovery_plan?.trim() ||
    entry.support_request?.trim()
  );
}

function isReasonComplete(reason: ReasonFormData) {
  return Boolean(
    reason.reason_category &&
    reason.reason_detail.trim() &&
    reason.action_today.trim() &&
    reason.recovery_plan.trim()
  );
}

function getReasonPayload(reason: ReasonFormData) {
  return {
    reason_category: reason.reason_category || null,
    reason_detail: reason.reason_detail.trim() || null,
    action_today: reason.action_today.trim() || null,
    recovery_plan: reason.recovery_plan.trim() || null,
    support_request: reason.support_request.trim() || null,
  } as any;
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

  const actualDate = reportDate || getActualDateFromPlanDate(getTodayPlanDate());
  const planDate = getPlanDateFromActualDate(actualDate);
  let report = getReport(actualDate);

  // 보고서가 없으면 자동 생성
  useEffect(() => {
    if (!report && canCreateReport) {
      createReport(actualDate);
    }
  }, [actualDate, canCreateReport]);

  report = getReport(actualDate);
  const entries = report ? getEntriesByReport(report.id) : [];
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
  const selectedReasonSource = selectedEntries.find(hasReasonContent) ?? selectedEntries[0];
  const selectedHasShortfall = selectedEntries.some(entry => getEntryShortfall(entry).hasShortfall);
  const [sharedReasons, setSharedReasons] = useState<Partial<Record<Equipment, ReasonFormData>>>({});
  const [sharedReasonErrors, setSharedReasonErrors] = useState<string[]>([]);
  const [sharedReasonSaved, setSharedReasonSaved] = useState(false);
  const sharedReason = sharedReasons[selectedEquipment] ?? getReasonFromEntry(selectedReasonSource);

  useEffect(() => {
    if (entries.length === 0) return;
    if (entries.some(entry => entry.equipment === selectedEquipment)) return;

    const firstEquipment = EQUIPMENT_LIST.find(equipment =>
      entries.some(entry => entry.equipment === equipment)
    );
    if (firstEquipment) {
      setSelectedEquipment(firstEquipment);
    }
  }, [entries, selectedEquipment]);

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
    selectedReasonSource?.action_today,
    selectedReasonSource?.recovery_plan,
    selectedReasonSource?.support_request,
  ]);

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

  const validateSharedReason = () => {
    if (!selectedHasShortfall) {
      setSharedReasonErrors([]);
      return true;
    }

    const errors: string[] = [];
    if (!sharedReason.reason_category) errors.push('미달성 사유를 선택해주세요.');
    if (!sharedReason.reason_detail.trim()) errors.push('상세 원인을 입력해주세요.');
    if (!sharedReason.action_today.trim()) errors.push('금일 조치사항을 입력해주세요.');
    if (!sharedReason.recovery_plan.trim()) errors.push('금일 만회계획을 입력해주세요.');

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
              목표값은 기준값으로만 표시되며, 전일 계획 대비 미달 항목은 사유와 만회대책을 작성해야 합니다.
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
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {equipmentTabs.map(tab => {
              const isActive = selectedEquipment === tab.equipment;
              const totalCount = tab.entries.length;
              const activeClass = tab.equipment === 'P15'
                ? 'border-blue-500 bg-blue-50 text-blue-800'
                : tab.equipment === 'P5'
                  ? 'border-purple-500 bg-purple-50 text-purple-800'
                  : 'border-green-500 bg-green-50 text-green-800';

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
            {selectedEntries.map(entry => (
              <EntryInputCard
                key={entry.id}
                entry={entry}
                reportId={report!.id}
                targets={targets}
                canWrite={canWrite}
                canEdit={canEdit}
                sharedReason={sharedReason}
                hasEquipmentShortfall={selectedHasShortfall}
                validateSharedReason={validateSharedReason}
                onSave={saveEntry}
                onSaveSharedReason={saveSharedReasonForEntries}
                onSubmit={submitEntry}
              />
            ))}
            <SharedReasonSection
              equipment={selectedEquipment}
              entries={selectedEntries}
              reason={sharedReason}
              errors={sharedReasonErrors}
              saved={sharedReasonSaved}
              canModify={canWrite || canEdit}
              hasShortfall={selectedHasShortfall}
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
  hasEquipmentShortfall,
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
  hasEquipmentShortfall: boolean;
  validateSharedReason: () => boolean;
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

  // 달성율 계산
  const productRate = formData.product_plan > 0
    ? (formData.product_actual / formData.product_plan * 100)
    : null;
  const billetRate = formData.billet_plan > 0
    ? (formData.billet_actual / formData.billet_plan * 100)
    : null;
  const productShortfall = Math.max(0, (formData.product_plan || 0) - (formData.product_actual || 0));
  const billetShortfall = Math.max(0, (formData.billet_plan || 0) - (formData.billet_actual || 0));
  const hasShortfall = productShortfall > 0 || billetShortfall > 0;
  const todayPlanTotal = (formData.next_product_plan || 0) + (formData.next_billet_plan || 0);
  const shiftTarget = targets.find(target => target.equipment === entry.equipment && target.shift === entry.shift);
  const equipmentTargets = targets.filter(target => target.equipment === entry.equipment);
  const equipmentProductTarget = equipmentTargets.reduce((sum, target) => sum + (target.product_target || 0), 0);
  const equipmentBilletTarget = equipmentTargets.reduce((sum, target) => sum + (target.billet_target || 0), 0);

  const handleChange = (field: string, value: string | number) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    setErrors([]);
    setSaved(false);
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
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const handleSubmit = () => {
    if (!canModify) return;
    if (!validate()) return;
    if (hasEquipmentShortfall && !validateSharedReason()) {
      setErrors(['미달성 사유는 하단의 설비 공통 입력란에 작성해주세요.']);
      return;
    }
    handleSave();
    onSubmit(entry.id);
  };

  const rateColor = (rate: number | null) => {
    if (rate === null) return 'text-gray-400';
    if (rate >= 100) return 'text-green-600';
    if (rate >= 90) return 'text-yellow-600';
    return 'text-red-600 font-bold';
  };

  return (
    <div className={`card ${hasShortfall && !isSubmitted ? 'border-orange-200' : ''}`}>
      {/* 카드 헤더 */}
      <div className={`card-header ${hasShortfall && !isSubmitted ? 'bg-orange-50' : 'bg-gray-50'}`}>
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 rounded-lg flex items-center justify-center font-bold text-sm text-white ${
            entry.equipment === 'P15' ? 'bg-blue-600' :
              entry.equipment === 'P5' ? 'bg-purple-600' : 'bg-green-600'
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
          ) : hasShortfall ? (
            <span className="flex items-center gap-1 text-orange-500 text-sm">
              <AlertCircle size={16} />
              미달 발생
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
                전일 계획과 전일 실적을 입력하고 달성율·미달량을 확인합니다.
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
                  <th colSpan={6} className="px-3 py-2 bg-blue-800 text-white text-left rounded-tl-lg">
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
                  <th className="px-3 py-2 bg-gray-700 text-white text-center">달성율</th>
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
                  <td className={`px-3 py-3 text-center font-bold text-base ${rateColor(productRate)}`}>
                    {productRate !== null ? `${productRate.toFixed(1)}%` : '-'}
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
                  <td className={`px-3 py-3 text-center font-bold text-base ${rateColor(billetRate)}`}>
                    {billetRate !== null ? `${billetRate.toFixed(1)}%` : '-'}
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
  entries,
  reason,
  errors,
  saved,
  canModify,
  hasShortfall,
  onChange,
  onSave,
}: {
  equipment: Equipment;
  entries: any[];
  reason: ReasonFormData;
  errors: string[];
  saved: boolean;
  canModify: boolean;
  hasShortfall: boolean;
  onChange: (field: keyof ReasonFormData, value: string) => void;
  onSave: () => void;
}) {
  const [isOpen, setIsOpen] = useState(hasShortfall);
  const shortfallRows = entries
    .map(entry => ({ entry, ...getEntryShortfall(entry) }))
    .filter(row => row.hasShortfall);

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
          {equipment} 공통 미달성 사유 및 만회대책
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
                <div>주간/야간 중 미달이 발생했습니다. 사유와 만회대책은 이 공통 입력란에 한 번만 작성합니다.</div>
                <div className="mt-1 text-xs">
                  {shortfallRows.map(row => (
                    <span key={row.entry.id} className="mr-3">
                      {row.entry.shift}: 제품 {formatNumber(row.productShortfall)} KG · 황지 {formatNumber(row.billetShortfall)} KG
                    </span>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="text-sm text-gray-500">
              현재 선택한 설비의 주간/야간 입력에는 미달이 없습니다. 필요 시 공통 메모로 작성할 수 있습니다.
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

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="form-label">
                금일 조치사항 {hasShortfall && <span className="text-red-500">*</span>}
              </label>
              <textarea
                value={reason.action_today}
                onChange={e => onChange('action_today', e.target.value)}
                disabled={!canModify}
                placeholder="금일 즉시 취한 또는 취할 조치를 작성해 주세요"
                className="form-textarea"
                rows={3}
              />
            </div>

            <div>
              <label className="form-label">
                금일 만회계획 {hasShortfall && <span className="text-red-500">*</span>}
              </label>
              <textarea
                value={reason.recovery_plan}
                onChange={e => onChange('recovery_plan', e.target.value)}
                disabled={!canModify}
                placeholder="금일 어느 설비에서 얼마를 추가 생산할지 수량 기준으로 작성"
                className="form-textarea"
                rows={3}
              />
            </div>
          </div>

          <div>
            <label className="form-label">지원 요청사항</label>
            <textarea
              value={reason.support_request}
              onChange={e => onChange('support_request', e.target.value)}
              disabled={!canModify}
              placeholder="관리자 또는 타 부서에 지원이 필요한 사항을 작성해 주세요 (선택)"
              className="form-textarea"
              rows={2}
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
