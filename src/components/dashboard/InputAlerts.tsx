import React from 'react';
import { AlertTriangle } from 'lucide-react';

interface InputAlert {
  title: string;
  message: string;
  tone: 'danger' | 'warning' | 'normal' | 'success';
}

const TONE_STYLES: Record<InputAlert['tone'], string> = {
  danger: 'border-red-200 bg-red-50',
  warning: 'border-amber-200 bg-amber-50',
  success: 'border-green-200 bg-green-50',
  normal: 'border-blue-200 bg-blue-50',
};

const TONE_TEXT: Record<InputAlert['tone'], string> = {
  danger: 'text-red-800',
  warning: 'text-amber-800',
  success: 'text-green-800',
  normal: 'text-blue-800',
};

interface InputAlertsProps {
  alerts: InputAlert[];
  periodLabel: string;
}

export function InputAlerts({ alerts, periodLabel }: InputAlertsProps) {
  return (
    <div className="card">
      <div className="card-header">
        <h3 className="font-semibold text-gray-800 flex items-center gap-2">
          <AlertTriangle size={16} className="text-amber-500" />
          입력 알림
        </h3>
        <span className="text-xs text-gray-500">{periodLabel} 기준</span>
      </div>
      <div className="card-body">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {alerts.map(alert => (
            <div
              key={alert.title}
              className={`rounded-lg border p-3 ${TONE_STYLES[alert.tone]}`}
            >
              <div className={`text-sm font-bold ${TONE_TEXT[alert.tone]}`}>
                {alert.title}
              </div>
              <div className="text-xs text-gray-600 mt-1 leading-relaxed">{alert.message}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
