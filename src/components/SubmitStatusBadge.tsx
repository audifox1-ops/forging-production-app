import React from 'react';
import { EntryStatus, ENTRY_STATUS_LABELS } from '../types';

interface SubmitStatusBadgeProps {
  status: EntryStatus;
}

const statusStyles: Record<EntryStatus, string> = {
  not_started: 'bg-gray-100 text-gray-500',
  saved: 'bg-yellow-100 text-yellow-700',
  submitted: 'bg-blue-100 text-blue-700',
  returned: 'bg-red-100 text-red-700',
  approved: 'bg-green-100 text-green-700',
};

export default function SubmitStatusBadge({ status }: SubmitStatusBadgeProps) {
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${statusStyles[status]}`}>
      {ENTRY_STATUS_LABELS[status]}
    </span>
  );
}
