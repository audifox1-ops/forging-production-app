import { describe, expect, it } from 'vitest';
import type { User } from '../src/types';
import { canCreateReport, resolveCurrentUser } from '../src/utils/userPermissions';

const user = (overrides: Partial<User>): User => ({
  id: 'user-1',
  name: '사용자',
  email: 'user@example.com',
  employee_no: '1',
  role: 'user',
  assigned_equipment: [],
  assigned_shift: null,
  can_write: false,
  can_edit: false,
  can_delete: false,
  created_at: '2026-01-01T00:00:00Z',
  ...overrides,
});

describe('user permissions', () => {
  it('falls back to the administrator when the stored user id is no longer present', () => {
    const admin = user({ id: 'admin', role: 'admin', name: '관리자' });
    const viewer = user({ id: 'viewer', role: 'viewer', name: '조회자' });

    expect(resolveCurrentUser([viewer, admin], 'removed-user')?.id).toBe('admin');
  });

  it('allows managers to create reports even when legacy rows lack permission flags', () => {
    expect(canCreateReport(user({ role: 'manager' }))).toBe(true);
  });
});
