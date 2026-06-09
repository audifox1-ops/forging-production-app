import React, { useState } from 'react';
import { useReportStore } from '../store/reportStore';
import { EQUIPMENT_LIST, SHIFT_LIST, PERIOD_TARGET_LABELS, PeriodTargetType } from '../types';
import { formatNumber } from '../utils/calculations';
import { ANNUAL_WORKDAYS_2026, WORKDAYS_2026_BY_MONTH } from '../utils/targetConfig';
import { Save, Lock } from 'lucide-react';

export default function TargetManagementPage() {
  const { targets, periodTargets, updateTarget, updatePeriodTarget, getCurrentUser } = useReportStore();
  const currentUser = getCurrentUser();
  const isAdmin = currentUser?.role === 'admin';
  const canManageTargets = isAdmin || Boolean(currentUser?.can_edit);
  const [localTargets, setLocalTargets] = useState(
    targets.reduce((acc, t) => {
      const key = `${t.equipment}-${t.shift}`;
      acc[key] = { product: t.product_target, billet: t.billet_target };
      return acc;
    }, {} as Record<string, { product: number; billet: number }>)
  );
  const [localPeriodTargets, setLocalPeriodTargets] = useState(
    periodTargets.reduce((acc, target) => {
      acc[target.period] = {
        product: target.product_target,
        billet: target.billet_target,
      };
      return acc;
    }, {} as Record<PeriodTargetType, { product: number; billet: number }>)
  );
  const [saved, setSaved] = useState(false);

  const handleChange = (equipment: string, shift: string, field: 'product' | 'billet', value: number) => {
    if (!canManageTargets) return;
    const key = `${equipment}-${shift}`;
    setLocalTargets(prev => ({
      ...prev,
      [key]: { ...prev[key], [field]: value },
    }));
    setSaved(false);
  };

  const handlePeriodChange = (period: PeriodTargetType, field: 'product' | 'billet', value: number) => {
    if (!canManageTargets) return;
    setLocalPeriodTargets(prev => ({
      ...prev,
      [period]: { ...prev[period], [field]: value },
    }));
    setSaved(false);
  };

  const handleSaveAll = () => {
    if (!canManageTargets) return;
    EQUIPMENT_LIST.forEach(equipment => {
      SHIFT_LIST.forEach(shift => {
        const key = `${equipment}-${shift}`;
        const val = localTargets[key];
        if (val) {
          updateTarget(equipment, shift, val.product, val.billet);
        }
      });
    });
    (Object.keys(PERIOD_TARGET_LABELS) as PeriodTargetType[]).forEach(period => {
      const val = localPeriodTargets[period] || { product: 0, billet: 0 };
      updatePeriodTarget(period, val.product, val.billet);
    });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  // 합계 계산
  const totalProduct = EQUIPMENT_LIST.reduce((sum, eq) => {
    return sum + (localTargets[`${eq}-주간`]?.product || 0) + (localTargets[`${eq}-야간`]?.product || 0);
  }, 0);
  const totalBillet = EQUIPMENT_LIST.reduce((sum, eq) => {
    return sum + (localTargets[`${eq}-주간`]?.billet || 0) + (localTargets[`${eq}-야간`]?.billet || 0);
  }, 0);
  const periodTotalProduct = (Object.keys(PERIOD_TARGET_LABELS) as PeriodTargetType[]).reduce((sum, period) => {
    return sum + (localPeriodTargets[period]?.product || 0);
  }, 0);
  const periodTotalBillet = (Object.keys(PERIOD_TARGET_LABELS) as PeriodTargetType[]).reduce((sum, period) => {
    return sum + (localPeriodTargets[period]?.billet || 0);
  }, 0);
  const annualProductTarget2026 = totalProduct * ANNUAL_WORKDAYS_2026;
  const annualBilletTarget2026 = totalBillet * ANNUAL_WORKDAYS_2026;

  return (
    <div className="space-y-5 fade-in max-w-4xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">목표값 관리</h1>
          <p className="text-sm text-gray-500 mt-0.5">일일·주간·월간·연간 생산 목표량을 설정합니다 (단위: KG)</p>
        </div>
        <button
          onClick={handleSaveAll}
          disabled={!canManageTargets}
          className="btn-primary flex items-center gap-2"
        >
          <Save size={16} />
          {saved ? '저장완료 ✓' : '전체 저장'}
        </button>
      </div>

      {!canManageTargets && (
        <div className="flex items-start gap-3 p-4 bg-gray-50 border border-gray-200 rounded-xl text-sm text-gray-600">
          <Lock size={18} className="text-gray-400 flex-shrink-0 mt-0.5" />
          <div>목표값을 입력하거나 수정하려면 관리자에게 편집 권한을 받아야 합니다.</div>
        </div>
      )}

      <div className="card">
        <div className="card-header">
          <h3 className="font-semibold text-gray-800">설비별 일일 생산 목표 (KG)</h3>
        </div>
        <div className="table-wrapper">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-blue-800 text-white">
                <th className="px-4 py-3 text-center">설비</th>
                <th className="px-4 py-3 text-center">근무조</th>
                <th className="px-4 py-3 text-right">제품 목표 (KG)</th>
                <th className="px-4 py-3 text-right">황지 목표 (KG)</th>
                <th className="px-4 py-3 text-right">합계 (KG)</th>
              </tr>
            </thead>
            <tbody>
              {EQUIPMENT_LIST.map(equipment => {
                const equipmentProduct = SHIFT_LIST.reduce((sum, shift) => {
                  return sum + (localTargets[`${equipment}-${shift}`]?.product || 0);
                }, 0);
                const equipmentBillet = SHIFT_LIST.reduce((sum, shift) => {
                  return sum + (localTargets[`${equipment}-${shift}`]?.billet || 0);
                }, 0);

                return (
                  <React.Fragment key={equipment}>
                    {SHIFT_LIST.map((shift, sIdx) => {
                      const key = `${equipment}-${shift}`;
                      const val = localTargets[key] || { product: 0, billet: 0 };
                      const rowTotal = (val.product || 0) + (val.billet || 0);

                      return (
                        <tr
                          key={key}
                          className={`border-b border-gray-100 ${sIdx === 0 ? 'border-t border-gray-200' : ''}`}
                        >
                          {sIdx === 0 && (
                            <td
                              className="px-4 py-3 text-center font-bold text-blue-800 bg-blue-50"
                              rowSpan={2}
                            >
                              {equipment}
                            </td>
                          )}
                          <td className="px-4 py-3 text-center text-gray-600">{shift}</td>
                          <td className="px-4 py-3 text-right">
                            <input
                              type="number"
                              value={val.product}
                              onChange={e => handleChange(equipment, shift, 'product', Number(e.target.value))}
                              min={0}
                              step={1000}
                              disabled={!canManageTargets}
                              className="w-32 px-2 py-1.5 border border-gray-300 rounded text-right text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 bg-blue-50"
                            />
                          </td>
                          <td className="px-4 py-3 text-right">
                            <input
                              type="number"
                              value={val.billet}
                              onChange={e => handleChange(equipment, shift, 'billet', Number(e.target.value))}
                              min={0}
                              step={1000}
                              disabled={!canManageTargets}
                              className="w-32 px-2 py-1.5 border border-gray-300 rounded text-right text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 bg-amber-50"
                            />
                          </td>
                          <td className="px-4 py-3 text-right font-medium text-gray-700">
                            {formatNumber(rowTotal)}
                          </td>
                        </tr>
                      );
                    })}
                    <tr className="bg-slate-50 font-semibold border-b border-gray-200">
                      <td colSpan={2} className="px-4 py-2.5 text-center text-slate-700">
                        {equipment} 합계
                      </td>
                      <td className="px-4 py-2.5 text-right text-blue-700">{formatNumber(equipmentProduct)}</td>
                      <td className="px-4 py-2.5 text-right text-amber-700">{formatNumber(equipmentBillet)}</td>
                      <td className="px-4 py-2.5 text-right text-slate-700">
                        {formatNumber(equipmentProduct + equipmentBillet)}
                      </td>
                    </tr>
                  </React.Fragment>
                );
              })}
              {/* 합계 행 */}
              <tr className="bg-blue-50 font-bold border-t-2 border-blue-200">
                <td colSpan={2} className="px-4 py-3 text-center">전체 합계</td>
                <td className="px-4 py-3 text-right text-blue-700">{formatNumber(totalProduct)}</td>
                <td className="px-4 py-3 text-right text-amber-700">{formatNumber(totalBillet)}</td>
                <td className="px-4 py-3 text-right">{formatNumber(totalProduct + totalBillet)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <h3 className="font-semibold text-gray-800">기간별 생산 목표 (KG)</h3>
        </div>
        <div className="table-wrapper">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-blue-800 text-white">
                <th className="px-4 py-3 text-center">기간</th>
                <th className="px-4 py-3 text-right">제품 목표 (KG)</th>
                <th className="px-4 py-3 text-right">황지 목표 (KG)</th>
                <th className="px-4 py-3 text-right">합계 (KG)</th>
              </tr>
            </thead>
            <tbody>
              {(Object.keys(PERIOD_TARGET_LABELS) as PeriodTargetType[]).map(period => {
                const val = localPeriodTargets[period] || { product: 0, billet: 0 };
                const rowTotal = (val.product || 0) + (val.billet || 0);

                return (
                  <tr key={period} className="border-b border-gray-100">
                    <td className="px-4 py-3 text-center font-bold text-blue-800 bg-blue-50">
                      {PERIOD_TARGET_LABELS[period]}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <input
                        type="number"
                        value={val.product}
                        onChange={e => handlePeriodChange(period, 'product', Number(e.target.value))}
                        min={0}
                        step={1000}
                        disabled={!canManageTargets}
                        className="w-36 px-2 py-1.5 border border-gray-300 rounded text-right text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 bg-blue-50 disabled:bg-gray-100"
                      />
                    </td>
                    <td className="px-4 py-3 text-right">
                      <input
                        type="number"
                        value={val.billet}
                        onChange={e => handlePeriodChange(period, 'billet', Number(e.target.value))}
                        min={0}
                        step={1000}
                        disabled={!canManageTargets}
                        className="w-36 px-2 py-1.5 border border-gray-300 rounded text-right text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 bg-amber-50 disabled:bg-gray-100"
                      />
                    </td>
                    <td className="px-4 py-3 text-right font-medium text-gray-700">
                      {formatNumber(rowTotal)}
                    </td>
                  </tr>
                );
              })}
              <tr className="bg-blue-50 font-bold border-t-2 border-blue-200">
                <td className="px-4 py-3 text-center">기간 목표 합계</td>
                <td className="px-4 py-3 text-right text-blue-700">{formatNumber(periodTotalProduct)}</td>
                <td className="px-4 py-3 text-right text-amber-700">{formatNumber(periodTotalBillet)}</td>
                <td className="px-4 py-3 text-right">{formatNumber(periodTotalProduct + periodTotalBillet)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <h3 className="font-semibold text-gray-800">2026 월별 근무일수 기준 목표 (KG)</h3>
        </div>
        <div className="table-wrapper">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-blue-800 text-white">
                <th className="px-4 py-3 text-center">월</th>
                <th className="px-4 py-3 text-right">근무일수</th>
                <th className="px-4 py-3 text-right">제품 목표 (KG)</th>
                <th className="px-4 py-3 text-right">황지 목표 (KG)</th>
                <th className="px-4 py-3 text-right">합계 (KG)</th>
              </tr>
            </thead>
            <tbody>
              {WORKDAYS_2026_BY_MONTH.map(({ month, workdays }) => {
                const productTarget = totalProduct * workdays;
                const billetTarget = totalBillet * workdays;

                return (
                  <tr key={month} className="border-b border-gray-100">
                    <td className="px-4 py-3 text-center font-bold text-blue-800 bg-blue-50">{month}월</td>
                    <td className="px-4 py-3 text-right tabular-nums">{formatNumber(workdays)}일</td>
                    <td className="px-4 py-3 text-right text-blue-700">{formatNumber(productTarget)}</td>
                    <td className="px-4 py-3 text-right text-amber-700">{formatNumber(billetTarget)}</td>
                    <td className="px-4 py-3 text-right font-medium text-gray-700">
                      {formatNumber(productTarget + billetTarget)}
                    </td>
                  </tr>
                );
              })}
              <tr className="bg-blue-50 font-bold border-t-2 border-blue-200">
                <td className="px-4 py-3 text-center">2026 연간 합계</td>
                <td className="px-4 py-3 text-right tabular-nums">{formatNumber(ANNUAL_WORKDAYS_2026)}일</td>
                <td className="px-4 py-3 text-right text-blue-700">{formatNumber(annualProductTarget2026)}</td>
                <td className="px-4 py-3 text-right text-amber-700">{formatNumber(annualBilletTarget2026)}</td>
                <td className="px-4 py-3 text-right">{formatNumber(annualProductTarget2026 + annualBilletTarget2026)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
}
