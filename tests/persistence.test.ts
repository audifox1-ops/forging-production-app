import { describe, expect, it } from 'vitest';
import type { PersistedReportState } from '../src/store/persistence';
import { getReportStateForSync } from '../src/store/persistence';

const state: PersistedReportState = {
  reports: [],
  entries: [],
  targets: [],
  periodTargets: [],
  templateSheets: [],
  users: [{
    id: 'admin',
    name: '관리자',
    email: 'admin@example.com',
    employee_no: '1',
    role: 'admin',
    assigned_equipment: [],
    assigned_shift: null,
    can_write: true,
    can_edit: true,
    can_delete: true,
    created_at: '2026-01-01T00:00:00Z',
  }],
  currentUserId: 'admin',
};

describe('Supabase report state sync', () => {
  it('does not include users because user management is persisted separately', () => {
    expect(getReportStateForSync(state).users).toEqual([]);
  });
});
