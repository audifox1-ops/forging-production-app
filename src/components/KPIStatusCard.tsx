import React from 'react';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';

interface KPIStatusCardProps {
  title: string;
  value: string;
  rate: number;
  subtitle?: string;
  invertColor?: boolean;
}

export default function KPIStatusCard({ title, value, rate, subtitle, invertColor = false }: KPIStatusCardProps) {
  const isGood = invertColor ? rate === 0 || rate >= 100 : rate >= 100;
  const isWarning = invertColor ? rate > 0 && rate < 30 : rate >= 90 && rate < 100;
  const isBad = invertColor ? rate >= 30 && rate < 100 : rate < 90;

  const bgColor = isGood ? 'bg-green-50 border-green-200' :
    isWarning ? 'bg-yellow-50 border-yellow-200' : 'bg-red-50 border-red-200';

  const textColor = isGood ? 'text-green-700' :
    isWarning ? 'text-yellow-700' : 'text-red-700';

  const Icon = isGood ? TrendingUp : isWarning ? Minus : TrendingDown;

  return (
    <div className={`kpi-card border ${bgColor}`}>
      <div className="flex items-center justify-between">
        <div className="text-xs font-medium text-gray-500">{title}</div>
        <Icon size={14} className={textColor} />
      </div>
      <div className={`text-2xl font-bold mt-1 ${textColor}`}>{value}</div>
      {subtitle && (
        <div className="text-xs text-gray-400 mt-0.5 truncate">{subtitle}</div>
      )}
    </div>
  );
}
