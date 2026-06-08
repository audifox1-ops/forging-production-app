import React, { useState } from 'react';
import { useReportStore } from '../store/reportStore';
import { EQUIPMENT_LIST, SHIFT_LIST, Equipment, Shift } from '../types';
import { formatNumber } from '../utils/calculations';
import { Save, Plus } from 'lucide-react';

export default function TargetManagementPage() {
  const { targets, updateTarget } = useReportStore();
  const [localTargets, setLocalTargets] = useState(
    targets.reduce((acc, t) => {
      const key = `${t.equipment}-${t.shift}`;
      acc[key] = { product: t.product_target, billet: t.billet_target };
      return acc;
    }, {} as Record<string, { product: number; billet: number }>)
  );
  const [saved, setSaved] = useState(false);

  const handleChange = (equipment: string, shift: string, field: 'product' | 'billet', value: number) => {
    const key = `${equipment}-${shift}`;
    setLocalTargets(prev => ({
      ...prev,
      [key]: { ...prev[key], [field]: value },
    }));
    setSaved(false);
  };

  const handleSaveAll = () => {
    EQUIPMENT_LIST.forEach(equipment => {
      SHIFT_LIST.forEach(shift => {
        const key = `${equipment}-${shift}`;
        const val = localTargets[key];
        if (val) {
          updateTarget(equipment, shift, val.product, val.billet);
        }
      });
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

  return (
    <div className="space-y-5 fade-in max-w-4xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">목표값 관리</h1>
          <p className="text-sm text-gray-500 mt-0.5">설비별 일일 생산 목표량을 설정합니다 (단위: KG)</p>
        </div>
        <button onClick={handleSaveAll} className="btn-primary flex items-center gap-2">
          <Save size={16} />
          {saved ? '저장완료 ✓' : '전체 저장'}
        </button>
      </div>

      <div className="card">
        <div className="card-header">
          <h3 className="font-semibold text-gray-800">설비별 생산 목표 (KG)</h3>
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
              {EQUIPMENT_LIST.map(equipment => (
                SHIFT_LIST.map((shift, sIdx) => {
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
                          className="w-32 px-2 py-1.5 border border-gray-300 rounded text-right text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 bg-amber-50"
                        />
                      </td>
                      <td className="px-4 py-3 text-right font-medium text-gray-700">
                        {formatNumber(rowTotal)}
                      </td>
                    </tr>
                  );
                })
              ))}
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
        <div className="card-body">
          <h3 className="font-semibold text-gray-700 mb-3">기준 목표값 (주간 기준)</h3>
          <div className="grid grid-cols-3 gap-4 text-sm">
            {EQUIPMENT_LIST.map(eq => {
              const dayKey = `${eq}-주간`;
              const val = localTargets[dayKey] || { product: 0, billet: 0 };
              return (
                <div key={eq} className="bg-gray-50 rounded-lg p-3">
                  <div className="font-bold text-gray-700 mb-2">{eq} / 주간</div>
                  <div className="space-y-1">
                    <div className="flex justify-between">
                      <span className="text-gray-500">제품:</span>
                      <span className="font-medium">{formatNumber(val.product)} KG</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">황지:</span>
                      <span className="font-medium">{formatNumber(val.billet)} KG</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
