import React from 'react';
import { formatNumber, getRateColorClass } from '../../utils/calculations';

interface SummaryCardProps {
  label: string;
  plan: number;
  actual: number;
  rate: number;
  shortfall: number;
  panelClass: string;
  labelClass: string;
  periodLabel: string;
}

export function SummaryCard({ label, plan, actual, rate, shortfall, panelClass, labelClass, periodLabel }: SummaryCardProps) {
  return (
    <div className={`rounded-lg border p-4 ${panelClass}`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className={`text-sm font-bold ${labelClass}`}>{label}</div>
          <div className="text-xs text-gray-500 mt-0.5">계획 대비 실적</div>
        </div>
        <div className={`text-2xl font-bold tabular-nums ${getRateColorClass(rate)}`}>
          {rate.toFixed(1)}%
        </div>
      </div>
      <div className="grid grid-cols-3 gap-3 mt-4 text-sm">
        <div>
          <div className="text-xs text-gray-500">{periodLabel}</div>
          <div className="font-semibold text-gray-800 tabular-nums">{formatNumber(plan)} KG</div>
        </div>
        <div>
          <div className="text-xs text-gray-500">실적</div>
          <div className="font-semibold text-gray-800 tabular-nums">{formatNumber(actual)} KG</div>
        </div>
        <div>
          <div className="text-xs text-gray-500">미달량</div>
          <div className={`font-semibold tabular-nums ${shortfall > 0 ? 'text-red-700' : 'text-gray-500'}`}>
            {shortfall > 0 ? `${formatNumber(shortfall)} KG` : '-'}
          </div>
        </div>
      </div>
    </div>
  );
}
