import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';
import { Save, Send, AlertCircle, CheckCircle, Info, ChevronDown, ChevronUp } from 'lucide-react';
import { useReportStore } from '../store/reportStore';
import { REASON_CATEGORIES, ReasonCategory } from '../types';
import { formatNumber } from '../utils/calculations';

export default function UserInputPage() {
  const { reportDate } = useParams<{ reportDate: string }>();
  const { getReport, getEntriesByReport, saveEntry, submitEntry, createReport } = useReportStore();

  const today = reportDate || format(new Date(), 'yyyy-MM-dd');
  let report = getReport(today);

  // 보고서가 없으면 자동 생성
  useEffect(() => {
    if (!report) {
      createReport(today);
    }
  }, [today]);

  report = getReport(today);
  const entries = report ? getEntriesByReport(report.id) : [];
  const isClosed = report?.status === 'closed';

  if (!report) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-400">보고서를 불러오는 중...</div>
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
                보고일: <span className="font-medium text-gray-700">
                  {format(new Date(today), 'yyyy년 MM월 dd일 (eee)', { locale: ko })}
                </span>
              </p>
              <p className="text-sm text-gray-500">공용 편집 모드: 전체 설비/근무조 입력 가능</p>
            </div>
            {isClosed && (
              <div className="flex items-center gap-2 px-3 py-2 bg-gray-100 text-gray-600 rounded-lg text-sm">
                <AlertCircle size={14} />
                마감된 보고서입니다. 수정이 불가합니다.
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 안내 배너 */}
      {!isClosed && (
        <div className="flex items-start gap-3 p-4 bg-blue-50 border border-blue-200 rounded-xl">
          <Info size={18} className="text-blue-500 flex-shrink-0 mt-0.5" />
          <div className="text-sm text-blue-700">
            <strong>전일 생산실적을 입력해 주세요.</strong>{' '}
            목표 대비 미달 항목은 미달성 사유와 만회대책을 반드시 작성해야 합니다.
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
        entries.map(entry => (
          <EntryInputCard
            key={entry.id}
            entry={entry}
            reportId={report!.id}
            isClosed={isClosed}
            onSave={saveEntry}
            onSubmit={submitEntry}
          />
        ))
      )}
    </div>
  );
}

// 개별 실적 입력 카드
function EntryInputCard({
  entry,
  reportId,
  isClosed,
  onSave,
  onSubmit,
}: {
  entry: any;
  reportId: string;
  isClosed: boolean;
  onSave: (data: any) => void;
  onSubmit: (id: string) => void;
}) {
  const isSubmitted = entry.submit_status === 'submitted' || entry.submit_status === 'approved';
  const [formData, setFormData] = useState({
    product_plan: entry.product_plan,
    product_actual: entry.product_actual,
    billet_plan: entry.billet_plan,
    billet_actual: entry.billet_actual,
    reason_category: entry.reason_category || '',
    reason_detail: entry.reason_detail || '',
    action_today: entry.action_today || '',
    recovery_plan: entry.recovery_plan || '',
    support_request: entry.support_request || '',
  });
  const [errors, setErrors] = useState<string[]>([]);
  const [showReasonSection, setShowReasonSection] = useState(false);
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

  useEffect(() => {
    setShowReasonSection(hasShortfall);
  }, [hasShortfall]);

  const handleChange = (field: string, value: string | number) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    setErrors([]);
    setSaved(false);
  };

  const validate = (): boolean => {
    const errs: string[] = [];
    if (formData.product_actual === 0 && formData.billet_actual === 0) {
      errs.push('제품 또는 황지 실적 중 하나 이상 입력해주세요.');
    }
    if (hasShortfall) {
      if (!formData.reason_category) errs.push('미달성 사유를 선택해주세요.');
      if (!formData.reason_detail.trim()) errs.push('상세 원인을 입력해주세요.');
      if (!formData.action_today.trim()) errs.push('금일 조치사항을 입력해주세요.');
      if (!formData.recovery_plan.trim()) errs.push('익일 만회계획을 입력해주세요.');
    }
    setErrors(errs);
    return errs.length === 0;
  };

  const handleSave = () => {
    onSave({
      id: entry.id,
      report_id: reportId,
      user_id: entry.user_id,
      equipment: entry.equipment,
      shift: entry.shift,
      ...formData,
    });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const handleSubmit = () => {
    if (!validate()) return;
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
        {/* 실적 입력 섹션 */}
        <div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr>
                  <th className="px-3 py-2 bg-gray-700 text-white text-center rounded-tl-lg">구분</th>
                  <th className="px-3 py-2 bg-gray-700 text-white text-right">계획 (KG)</th>
                  <th className="px-3 py-2 bg-blue-600 text-white text-right">실적 (KG)</th>
                  <th className="px-3 py-2 bg-gray-700 text-white text-center">달성율</th>
                  <th className="px-3 py-2 bg-gray-700 text-white text-right rounded-tr-lg">미달량 (KG)</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b border-gray-100">
                  <td className="px-3 py-3 font-semibold text-gray-700 bg-gray-50 text-center">제 품</td>
                  <td className="px-3 py-3 text-right">
                    <input
                      type="number"
                      value={formData.product_plan}
                      onChange={e => handleChange('product_plan', Number(e.target.value))}
                      disabled={isClosed}
                      min={0}
                      className="w-full px-2 py-1.5 border border-gray-200 rounded text-right text-sm bg-gray-50 disabled:bg-gray-100"
                    />
                  </td>
                  <td className="px-3 py-3 text-right">
                    <input
                      type="number"
                      value={formData.product_actual}
                      onChange={e => handleChange('product_actual', Number(e.target.value))}
                      disabled={isClosed}
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
                </tr>
                <tr>
                  <td className="px-3 py-3 font-semibold text-gray-700 bg-gray-50 text-center">황 지</td>
                  <td className="px-3 py-3 text-right">
                    <input
                      type="number"
                      value={formData.billet_plan}
                      onChange={e => handleChange('billet_plan', Number(e.target.value))}
                      disabled={isClosed}
                      min={0}
                      className="w-full px-2 py-1.5 border border-gray-200 rounded text-right text-sm bg-gray-50 disabled:bg-gray-100"
                    />
                  </td>
                  <td className="px-3 py-3 text-right">
                    <input
                      type="number"
                      value={formData.billet_actual}
                      onChange={e => handleChange('billet_actual', Number(e.target.value))}
                      disabled={isClosed}
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
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* 미달성 사유 섹션 */}
        {(hasShortfall || showReasonSection) && (
          <div className={`border rounded-xl overflow-hidden ${hasShortfall ? 'border-orange-200' : 'border-gray-200'}`}>
            <button
              type="button"
              onClick={() => setShowReasonSection(!showReasonSection)}
              className={`w-full flex items-center justify-between px-4 py-3 text-sm font-semibold ${
                hasShortfall ? 'bg-orange-50 text-orange-700' : 'bg-gray-50 text-gray-700'
              }`}
            >
              <span className="flex items-center gap-2">
                <AlertCircle size={15} />
                미달성 사유 및 만회대책
                {hasShortfall && <span className="text-red-500 text-xs">* 필수 입력</span>}
              </span>
              {showReasonSection ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
            </button>

            {showReasonSection && (
              <div className="p-4 space-y-4 bg-orange-50/30">
                {/* 미달 안내 */}
                {hasShortfall && (
                  <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
                    <AlertCircle size={15} className="flex-shrink-0 mt-0.5" />
                    목표 대비 실적이 미달되었습니다. 미달성 사유, 상세 원인, 금일 조치사항, 익일 만회계획을 작성해 주세요.
                  </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* 미달성 사유 선택 */}
                  <div>
                    <label className="form-label">
                      미달성 사유 {hasShortfall && <span className="text-red-500">*</span>}
                    </label>
                    <select
                      value={formData.reason_category}
                      onChange={e => handleChange('reason_category', e.target.value)}
                      disabled={isClosed}
                      className="form-select"
                    >
                      <option value="">선택하세요</option>
                      {REASON_CATEGORIES.map(cat => (
                        <option key={cat} value={cat}>{cat}</option>
                      ))}
                    </select>
                  </div>

                  {/* 상세 원인 작성 가이드 */}
                  {formData.reason_category && (
                    <div className="text-xs text-gray-500 bg-gray-50 border border-gray-200 rounded-lg p-3">
                      <strong className="text-gray-700">작성 가이드:</strong>
                      <div className="mt-1">
                        {getReasonGuide(formData.reason_category as ReasonCategory)}
                      </div>
                    </div>
                  )}
                </div>

                {/* 상세 원인 */}
                <div>
                  <label className="form-label">
                    상세 원인 {hasShortfall && <span className="text-red-500">*</span>}
                  </label>
                  <textarea
                    value={formData.reason_detail}
                    onChange={e => handleChange('reason_detail', e.target.value)}
                    disabled={isClosed}
                    placeholder="구체적인 원인을 작성해 주세요 (설비명, 시간, 수량 등 포함)"
                    className="form-textarea"
                    rows={3}
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* 금일 조치사항 */}
                  <div>
                    <label className="form-label">
                      금일 조치사항 {hasShortfall && <span className="text-red-500">*</span>}
                    </label>
                    <textarea
                      value={formData.action_today}
                      onChange={e => handleChange('action_today', e.target.value)}
                      disabled={isClosed}
                      placeholder="금일 즉시 취한 또는 취할 조치를 작성해 주세요"
                      className="form-textarea"
                      rows={3}
                    />
                  </div>

                  {/* 익일 만회계획 */}
                  <div>
                    <label className="form-label">
                      익일 만회계획 {hasShortfall && <span className="text-red-500">*</span>}
                    </label>
                    <textarea
                      value={formData.recovery_plan}
                      onChange={e => handleChange('recovery_plan', e.target.value)}
                      disabled={isClosed}
                      placeholder="언제, 어느 설비에서, 얼마를 추가 생산할지 수량 기준으로 작성"
                      className="form-textarea"
                      rows={3}
                    />
                  </div>
                </div>

                {/* 지원 요청사항 */}
                <div>
                  <label className="form-label">지원 요청사항</label>
                  <textarea
                    value={formData.support_request}
                    onChange={e => handleChange('support_request', e.target.value)}
                    disabled={isClosed}
                    placeholder="관리자 또는 타 부서에 지원이 필요한 사항을 작성해 주세요 (선택)"
                    className="form-textarea"
                    rows={2}
                  />
                </div>
              </div>
            )}
          </div>
        )}

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
        {!isClosed && (
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

        {isSubmitted && !isClosed && (
          <div className="flex items-center justify-center gap-2 py-2 text-green-600 font-medium text-sm">
            <CheckCircle size={18} />
            제출완료 상태이며, 공용 편집 모드에서 수정할 수 있습니다.
          </div>
        )}
      </div>
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
